import { ALL_KEYS_CH, DEFAULT_SHIFT_RATE } from "./constants"
import { CloneCondition, ExecCallback, QueueItem, QueueKind, Rules } from "./types"
import { Storage } from "./storage/Storage"
import { FileSystemStorage } from "./storage/FileSystem"
import { MemoryStorage } from "./storage/Memory"
import { registerNewQueue } from "./pool"

/**Init a Queue (FIFO by default, in Memory by default)
 * @param name - provide a unique name for the queue
 * @param shiftRate - provide the number of shifts per second (default: 60) */
export function SmartQueue<T = any>(name: string, shiftRate: number = DEFAULT_SHIFT_RATE) {
	return new Queue<T>(name, shiftRate)
}

export class Queue<T = any> {
	private storage: Storage<T>
	private name: string
	private shiftEnabled = false
	private shiftRate: number

	private priorities: string[] = []
	private ignoreUnknownKeys: boolean = false

	private globalRules: Rules<T> = {}
	private keyRules: { [key: string]: Rules<T> } = {}

	constructor(name: string, shiftRate: number = DEFAULT_SHIFT_RATE) {
		this.name = name
		this.storage = new MemoryStorage(name)	
		this.shiftRate = 1000 / shiftRate
		registerNewQueue(this)
		this.startShiftLoop()
	}

	getName() {
		return this.name
	}

	private orderKeysByPriority(): string[] {
		const currentKeys = Object.keys(this.keyRules)
		const notPrioritized = currentKeys.filter(key => !this.priorities.includes(key))

		if (this.ignoreUnknownKeys) return this.priorities
		return this.priorities.concat(notPrioritized)
	}

	private async startShiftLoop() {
		while (true) {
			const start = Date.now()
			const oderedKeys = this.orderKeysByPriority()
			if (this.shiftEnabled) {
				for (let key of oderedKeys) {
					const keyRules = this.keyRules[key] || {}

					if (
						!keyRules.exec &&
						!keyRules.execAsync && 
						!this.globalRules.exec &&
						!this.globalRules.execAsync
					) continue

					if (!!keyRules.locked) {
						const lockSpan = keyRules.every || this.globalRules.every
						if ((Date.now() - keyRules.lastLockTimestamp) >= lockSpan) {
							this.unlockKey(key)
						} else continue
					}

					const shiftSize = keyRules.shiftSize || 1
					const output = this.getKeyShiftKind(key) == "FIFO" ?
						await this.storage.shiftFIFO(key, shiftSize) : 
						await this.storage.shiftLIFO(key, shiftSize)
					
					this.shiftEnabled = false
					for (let count of Object.values(output.storedCount)) 
						if (count != 0) 
							this.shiftEnabled = true

					if (output.items.length != 0) {
						for (let item of this.parseItemsPost(key, output.items)) {
							if (this.keyRules[key].exec || this.keyRules[key].execAsync) {
								if (this.keyRules[key].exec) await this.keyRules[key].exec(item.value, key, this.name)
								else if (this.keyRules[key].execAsync) this.keyRules[key].execAsync(item.value, key, this.name)
							} else if (this.globalRules.exec || this.globalRules.execAsync) {
								if (this.globalRules.exec) await this.globalRules.exec(item.value, key)
								else if (this.globalRules.execAsync) this.globalRules.execAsync(item.value, key, this.name)
							}
						}

						if (keyRules.every || this.globalRules.every) this.lockKey(key)

						const end = Date.now()
						const timeSpent = end - start
						if (timeSpent < this.shiftRate) 
							await new Promise(r => setTimeout(() => r(0), this.shiftRate - timeSpent))

						break //break every time that something get flushed from the queue in order to recalculate priorities
					}
				}
			} else await new Promise(r => setTimeout(() => r(0), this.shiftRate || DEFAULT_SHIFT_RATE))
		}
	}

	private lockKey(key: string) {
		this.keyRules[key].locked = true
		this.keyRules[key].lastLockTimestamp = Date.now()
	}

	private unlockKey(key: string) {
		this.keyRules[key].locked = false
		this.keyRules[key].lastLockTimestamp = undefined
	}

	/**Push an item in the queue for a certain key
	 * @param key - provide a key (* refers to all keys and will throw an error when used as a key)
	 * @param item - item to be pushed in the queue*/
	async push(key: string, item: T) {
		if (key == ALL_KEYS_CH) throw Error(`"*" character cannot be used as a key (refers to all keys)`)

		if (this.ignoreUnknownKeys) 
			if (!this.priorities.includes(key))
				return

		this.parseKey(key)

		const queueItem: QueueItem<T> = {
			pushTimestamp: Date.now(),
			value: item
		} 

		if (this.getRule(key, "clonePre")) {
			let toBeCloned = true

			if (this.getRule(key, "clonePreCondition")) 
				toBeCloned = this.getRule(key, "clonePreCondition")()

			if (toBeCloned) {
				for (let i = 0; i < this.getRule(key, "clonePre"); i++) {
					await this.storage.push(key, queueItem)
				}
			} else await this.storage.push(key, queueItem)
		} else await this.storage.push(key, queueItem)

		this.shiftEnabled = true
	}

	/**Set FIFO behaviour (default). If a key is provided the behaviour is applied to that key and overrides the queue global behaviour for that key
	 * @param key - provide a key (* refers to all keys)*/
	fifo(key: string = "*") {
		this.parseKey(key)
		this.setRule(key, "kind", "FIFO")
		return this
	}

	/**Set LIFO behaviour. If a key is provided the behaviour is applied to that key and overrides the queue global behaviour for that key
	 * @param key - provide a key (* refers to all keys)*/
	lifo(key: string = "*") {
		this.parseKey(key)
		this.setRule(key, "kind", "LIFO")
		return this
	}

	/**Set keys priority (fist keys in the array have higher priority)
	* @param key - provide a key (* refers to all keys)
	* @param ignoreUnknownKeys - ignore all pushed items whose key is not included in the provided priority array*/
	priority(keys: string[], ignoreUnknownKeys: boolean = false) {
		this.ignoreUnknownKeys = ignoreUnknownKeys
		this.priorities = keys
		return this
	} 

	/**Set a callback to be executed syncronously (awaited if async) when flushing items for a specific key
	* @param key - provide a key (* refers to all keys)
	* @param callback - (item, key?) => { ..some action.. } [can be async]*/
	exec(key: string, callback: ExecCallback<T>) {
		this.parseKey(key)
		this.setRule(key, "execAsync", undefined)
		this.setRule(key, "exec", callback)
		return this
	}

	/**Set a callback to be executed asyncronously (not awaited if async) when flushing items for a specific key
	* @param key - provide a key (* refers to all keys)
	* @param callback - (item, key?) => { ..some action.. } [can be async]*/
	execAsync(key: string, callback: ExecCallback<T>) {
		this.parseKey(key)
		this.setRule(key, "exec", undefined)
		this.setRule(key, "execAsync", callback)
		return this
	}

	/**Set the number of items to flush at one time (the exec calback is called once for each item separately)
	* @param key - provide a key (* refers to all keys)
	* @param size - flush size*/
	flushSize(key: string, size: number) {
		this.parseKey(key)
		this.setRule(key, "shiftSize", size)
		return this
	}

	/**Set the number of milliseconds that the queue has to wait befor flushing again for a specific key (net of flush execution time)
	* @param key - provide a key (* refers to all keys)
	* @param delay - milliseconds*/
	every(key: string, delay: number) {
		this.parseKey(key)
		this.setRule(key, "every", delay)
		return this
	}

	/**Clone items of a specific key n times when pushing them from the queue
	 * @param key - provide a key (* refers to all keys)
	 * @param count - provide the number of clones*/
	clonePre(key: string, count: number, condition?: CloneCondition<T>) {
		this.parseKey(key)
		this.setRule(key, "clonePre", count)
		this.setRule(key, "clonePreCondition", condition)
		return this
	}

	/**Clone items of a specific key n times when flushing them from the queue
	 * @param key - provide a key (* refers to all keys)
	 * @param count - provide the number of clones*/
	clonePost(key: string, count: number, condition?: CloneCondition<T>) {
		this.parseKey(key)
		this.setRule(key, "clonePost", count)
		this.setRule(key, "clonePostCondition", condition)
		return this
	}

	/**register default key rules and return true if key is the global character*/
	private parseKey(key: string): boolean {
		if (key == ALL_KEYS_CH) return true
		if (!this.keyRules[key]) this.keyRules[key] = this.defaultKeyRulse()
		return false
	}

	/**Key kind overrides queue kind*/
	private getKeyShiftKind(key: string): QueueKind {
		if (key == ALL_KEYS_CH) return this.globalRules.kind
		if (this.keyRules[key].kind == "FIFO") return "FIFO"
		if (this.keyRules[key].kind == "LIFO") return "LIFO"
		return this.globalRules.kind
	}

	private setRule(key: string, rule: string, value: any) {
		if (!rule) return
		if (key == ALL_KEYS_CH) this.globalRules[rule] = value
		else this.keyRules[key][rule] = value
	}

	private getRule(key: string, rule: string) {
		if (key != ALL_KEYS_CH) return this.keyRules[key][rule]
		else return this.globalRules[rule]
	}

	private defaultKeyRulse(): Rules<T> {
		return {}
	}

	/**Clones items if a clonePost rule is provided for the key or as a global rule*/
	private parseItemsPost(key: string, items: QueueItem<T>[]): QueueItem<T>[] {
		let clonesNum: number
		let cloneCondition: CloneCondition<T>

		if (this.keyRules[key].clonePost) {
			clonesNum = this.keyRules[key].clonePost
			cloneCondition = this.keyRules[key].clonePostCondition
		} else if (this.globalRules.clonePost) {
			clonesNum = this.globalRules.clonePost
			cloneCondition = this.globalRules.clonePostCondition
		}

		if (!clonesNum) return items
		else return items.flatMap(i => {
			const toBeCloned = cloneCondition ? cloneCondition(i.value) : true
			if (toBeCloned) {
				const clonedItems = []

				for (let j = 0; j < clonesNum; j++) 
					clonedItems.push(i)

				return clonedItems
			} else return [i]
		})
	}

	// STORAGE SYSTEMS

	/**Set a FS storage
	 * @param file - provide the path to the storage file (can be the same accross different queues)*/
	fileSystemStorage(file: string) {
		this.storage = new FileSystemStorage(this.name, file)
		return this
	}

	/**Set an in Memory storage (default)*/
	inMemoryStorage() {
		this.storage = new MemoryStorage(this.name)
		return this
	}
}