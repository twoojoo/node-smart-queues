import { CloneCondition, ExecCallback, IgnoreItemCondition, OnPushCallback, PriorityOptions, QueueItem, QueueKind, QueueOptions, Rules } from "./types"
import { ALL_KEYS_CH, DEFAULT_SHIFT_RATE } from "./constants"
import { FileSystemStorage } from "./storage/FileSystem"
import { MemoryStorage } from "./storage/Memory"
import { Storage } from "./storage/Storage"
import { registerNewQueue } from "./pool"
import { shuffleArray } from "./utils"

/**Init a Queue (FIFO by default, in Memory by default)
 * @param name - provide a unique name for the queue
 * @param shiftRate - provide the number of shifts per second (default: 60) */
export function SmartQueue<T = any>(name: string, options: QueueOptions = {}) {
	return new Queue<T>(name, options)
}

export class Queue<T = any> {
	private storage: Storage<T>
	private logger: boolean = true
	private name: string
	private shiftRate: number

	private looping: boolean = false
	private paused: boolean = false
	private shiftEnabled = false

	private priorities: string[] = []
	private randomized: boolean = false
	private ignoreNotPrioritized: boolean = false
	private keysToIgnore: string[] = []

	private globalRules: Rules<T> = {}
	private keyRules: { [key: string]: Rules<T> } = {}

	constructor(name: string, options: QueueOptions = {}) {
		if (options.logger === false) this.logger = false
		this.name = name
		this.storage = new MemoryStorage(name)	
		this.shiftRate = 1000 / (options.shiftRate || DEFAULT_SHIFT_RATE)
		registerNewQueue(this)
	}

	getName() {
		return this.name
	}

	/**Starts the queue*/
	start() {
		if (this.logger) console.log(new Date(), `#> starting queue`, this.name)

		this.paused = false
		if (!this.looping) this.startShiftLoop()

		return this
	}

	/** Pause the queue (pause indefinitely if timer is not provided)
	 * @param timer - set a timer for the queue restart (calls start() after the timer has expiret)*/
	pause(timer?: number) {
		if (this.logger) console.log(new Date(), `#> pausing queue`, this.name, timer ? `for ${timer}ms` : "indefinitely")

		this.paused = true
		this.looping = false
		if (timer || timer == 0) setTimeout(() => this.start(), timer)

		return this
	}

	/**Set a callback to be executed syncronously (awaited if async) when pushing items for a specific key
	* @param key - provide a key (* refers to all keys)
	* @param callback - (item, key?, queue?) => { ..some action.. } [can be async]*/
	onPush(key: string, callback: OnPushCallback<T>) {
		this.parseKey(key)
		this.setRule(key, "onPushAsync", undefined)
		this.setRule(key, "onPush", callback)
		return this
	}

	/**Set a callback to be executed asyncronously (not awaited if async) when pushing items for a specific key
	* @param key - provide a key (* refers to all keys)
	* @param callback - (item, key?, queue?) => { ..some action.. } [can be async]*/
	onPushAsync(key: string, callback: OnPushCallback<T>) {
		this.parseKey(key)
		this.setRule(key, "onPush", undefined)
		this.setRule(key, "onPushAsync", callback)
		return this
	}

	private calculatePriority(): string[] {
		const currentKeys = Object.keys(this.keyRules)

		if (this.randomizePriority) 
			return shuffleArray(currentKeys)
		
		const notPrioritized = currentKeys.filter(key => !this.priorities.includes(key))

		return this.priorities.concat(notPrioritized)
	}

	private async startShiftLoop() {
		this.looping = true
		while (true) {
			if (this.paused) break
			const start = Date.now()
			const oderedKeys = this.calculatePriority()
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
							if (this.logger) console.log(new Date(), `#> flushed item - queue: ${this.name} - key: ${key}`)
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

		this.looping = false
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
	 * @param item - item to be pushed in the queue
	 * @returns true if the item wasn't ignored by the queue
	 * */
	async push(key: string, item: T): Promise<boolean> {
		if (key == ALL_KEYS_CH) throw Error(`"*" character cannot be used as a key (refers to all keys)`)

		//check if the key is to be ignored
		if (this.keysToIgnore.includes(key)) 
			return false

		//check if the key is not prioritized and should be skipped
		if (this.ignoreNotPrioritized) 
			if (!this.priorities.includes(key))
				return false

		this.parseKey(key)

		//check if there is a condition for the item to 
		//be ignored and calculate the condition result
		const ignoreItemCondition = 
			this.keyRules[key].ignoreItemCondition || 
			this.globalRules.ignoreItemCondition

		if (ignoreItemCondition)
			if (ignoreItemCondition(item))
				return false

		const queueItem: QueueItem<T> = {
			pushTimestamp: Date.now(),
			value: item
		}

		const cloneNum = 
			this.keyRules[key].clonePre ||
			this.globalRules.clonePre

		if (cloneNum) {
			let toBeCloned = true

			const cloneCondition = 
				this.keyRules[key].clonePreCondition || 
				this.globalRules.clonePreCondition

			if (cloneCondition) 
				toBeCloned = cloneCondition(item)

			if (toBeCloned) {
				for (let i = 0; i < cloneNum; i++) 
					await this.pushItemInStorage(key, queueItem)
			} else await this.pushItemInStorage(key, queueItem)

		} else await this.pushItemInStorage(key, queueItem)

		this.shiftEnabled = true

		return true
	}

	/**Push an item to the storage after executin onPush hooks if they exist*/
	private async pushItemInStorage(key: string, item: QueueItem<T>) {
		if (this.logger) console.log(new Date(), `#> pushed item - queue: ${this.name} - key: ${key}`)
		if (this.keyRules[key].onPush) await this.keyRules[key].onPush(item.value, key, this.name)
		else if (this.keyRules[key].onPushAsync) this.keyRules[key].onPushAsync(item.value, key, this.name)
		else if (this.globalRules.onPush) await this.globalRules.onPush(item.value, key, this.name)
		else if (this.globalRules.onPushAsync) await this.globalRules.onPushAsync(item.value, key, this.name)
		this.storage.push(key, item)
	}

	/**Set FIFO behaviour (default). If a key is provided the behaviour is applied to that key and overrides the queue global behaviour for that key
	 * @param key - provide a key (* refers to all keys)*/
	setFIFO(key: string = "*") {
		this.parseKey(key)
		this.setRule(key, "kind", "FIFO")
		return this
	}

	/**Set LIFO behaviour. If a key is provided the behaviour is applied to that key and overrides the queue global behaviour for that key
	 * @param key - provide a key (* refers to all keys)*/
	setLIFO(key: string = "*") {
		this.parseKey(key)
		this.setRule(key, "kind", "LIFO")
		return this
	}

	/**Set keys priority (fist keys in the array have higher priority)
	* @param key - provide a key (* is forbidden here)
	* @param options.ignoreUnknownKeys - ignore all pushed items whose key is not included in the provided priority array*/
	setPriority(keys: string[], options: PriorityOptions = {}) {
		if (keys.includes(ALL_KEYS_CH)) throw Error("* cannot be used here (refers to all keys)")
		this.randomized = false
		this.ignoreNotPrioritized = !!options.ignoreNotPrioritized
		this.priorities = keys
		return this
	} 

	randomizePriority() {
		this.randomized = true
		return this
	}

	/**Set a callback to be executed syncronously (awaited if async) when flushing items for a specific key
	* @param key - provide a key (* refers to all keys)
	* @param callback - (item, key?, queue?) => { ..some action.. } [can be async]*/
	onFlush(key: string, callback: ExecCallback<T>) {
		this.parseKey(key)
		this.setRule(key, "execAsync", undefined)
		this.setRule(key, "exec", callback)
		return this
	}

	/**Set a callback to be executed asyncronously (not awaited if async) when flushing items for a specific key
	* @param key - provide a key (* refers to all keys)
	* @param callback - (item, key?, queue?) => { ..some action.. } [can be async]*/
	onFlushAsync(key: string, callback: ExecCallback<T>) {
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
	flushEvery(key: string, delay: number) {
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

	/**Ignores items pushed for the provided keys (dosen't override previously ignored key)
	 * @param keys - provide a list of keys (key * is forbidden)*/
	ignoreKeys(keys: string[] | string) {
		if (Array.isArray(keys)) {
			if (keys.includes(ALL_KEYS_CH)) 
				throw Error("cannot ignore all keys (*) - use pause() instead")	

			this.keysToIgnore = Array.from(new Set(this.keysToIgnore.concat(keys)))
		} else {
			if (keys == ALL_KEYS_CH) 
				throw Error("cannot ignore all keys (*) - use pause() instead")	

			this.keysToIgnore = Array.from(new Set(this.keysToIgnore.concat([keys])))
		}
		return this
	} 

	/**Ignores items pushed for the provided keys (doen't override previously ignored key)
	* @param keys - provide a list of keys (* restores all keys)*/
	restoreKeys(keys: string[] | string) {
		if (Array.isArray(keys)) {
			if (keys.includes(ALL_KEYS_CH)) this.keysToIgnore = []
			else this.keysToIgnore = this.keysToIgnore.filter(k => !keys.includes(k))
		} else {
			if (keys == ALL_KEYS_CH) this.keysToIgnore = []
			else this.keysToIgnore = this.keysToIgnore.filter(k => keys == k)
		}

		return this
	}

	/**Set a condition for pushed items to be ignored
	 * @param keys - provide a keys (* refers to all keys)
	 * @param condition - if returns true, the item is ignored*/
	ignoreItem(key: string, condition: IgnoreItemCondition<T>) {
		this.parseKey(key)
		this.setRule(key, "ignoreItemCondition", condition)
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

	// private getRule(key: string, rule: string) {
	// 	if (key != ALL_KEYS_CH) return this.keyRules[key][rule]
	// 	else return this.globalRules[rule]
	// }

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

	/**Tells if the queue is paused*/
	isPaused(): boolean {
		return this.paused
	}

	/**Tells if a key is ignored by the queue*/
	isKeyIgnored(key: string): boolean {
		if (key == ALL_KEYS_CH) throw Error("* refers to all keys and cannot be used here")
		return !!this.keysToIgnore.includes(key)
	}

	/**Tells if the queue is looping*/
	isLooping(): boolean {
		return this.looping
	}

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