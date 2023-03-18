import { CloneCondition, ExecCallback, IgnoreItemCondition, OnMaxRetryCallback, OnPushCallback, PriorityOptions, QueueItem, QueueItemParsed, QueueKind, Rules, StorageShiftOutput } from "./types"
import { ALL_KEYS_CH, DEFAULT_SHIFT_RATE } from "./constants"
import { FileSystemStorage } from "./storage/FileSystem"
import { MemoryStorage } from "./storage/Memory"
import { RedisStorage } from "./storage/Redis"
import { Storage } from "./storage/Storage"
import { registerNewQueue } from "./pool"
import { gzip, ungzip } from "node-gzip"
import { shuffleArray } from "./utils"
import { Redis } from "ioredis"

/**Init a Queue (FIFO by default, in Memory by default)
 * @param name - provide a unique name for the queue*/
export function SmartQueue<T = any>(name: string) {
	return new Queue<T>(name)
}

export class Queue<T = any> {
	private storage: Storage
	private _logger: boolean = false
	private name: string
	private shiftRate: number = 1000 / DEFAULT_SHIFT_RATE

	private looping: boolean = false
	private paused: boolean = false
	private shiftEnabled = false

	private priorities: string[] = []
	private randomized: boolean = false
	private ignoreNotPrioritized: boolean = false
	private keysToIgnore: string[] = []

	private globalRules: Rules<T> = {}
	private keyRules: { [key: string]: Rules<T> } = {}

	private firstItemPushed: boolean = false
	private _gzip: boolean = false

	constructor(name: string) {
		this.name = name
		this.storage = new MemoryStorage(name)	
		registerNewQueue(this)
	}

	getName() {
		return this.name
	}

	/**Starts the queue*/
	start() {
		if (this._logger) console.log(new Date(), `#> starting queue`, this.name)

		this.paused = false
		if (!this.looping) this.startShiftLoop()

		return this
	}

	/** Pause the queue (pause indefinitely if timer is not provided)
	 * @param timer - set a timer for the queue restart (calls start() after the timer has expiret)*/
	pause(timer?: number) {
		if (this._logger) console.log(new Date(), `#> pausing queue`, this.name, timer ? `for ${timer}ms` : "indefinitely")

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

		if (this.randomized) 
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
					const output: StorageShiftOutput = this.getKeyShiftKind(key) == "FIFO" ?
						await this.storage.shiftFIFO(key, shiftSize) : 
						await this.storage.shiftLIFO(key, shiftSize)
					
					this.shiftEnabled = false
					for (let count of Object.values(output.storedCount)) 
						if (count != 0) 
							this.shiftEnabled = true

					if (output.items.length != 0) {
						for (let item of await this.parseItemsPost(key, output.items)) {
							if (this.keyRules[key].exec || this.keyRules[key].execAsync) {
								if (this.keyRules[key].exec) await this.flushItemFromQueue(key, item.value, this.keyRules[key].exec)
								else if (this.keyRules[key].execAsync) this.flushItemFromQueue(key, item.value, this.keyRules[key].execAsync)
							} else if (this.globalRules.exec || this.globalRules.execAsync) {
								if (this.globalRules.exec) this.flushItemFromQueue(key, item.value, this.globalRules.exec)
								else if (this.globalRules.execAsync) this.flushItemFromQueue(key, item.value, this.globalRules.execAsync)
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
					await this.pushItemInStorage(key, item)
			} else await this.pushItemInStorage(key, item)

		} else await this.pushItemInStorage(key, item)

		this.shiftEnabled = true

		return true
	}

	/**Push an item to the storage after executin onPush hooks if they exist*/
	private async pushItemInStorage(key: string, item: T) {
		if (this._logger) console.log(new Date(), `#> pushed item - queue: ${this.name} - key: ${key}`)
		if (this.keyRules[key].onPush) await this.keyRules[key].onPush(item, key, this)
		else if (this.keyRules[key].onPushAsync) this.keyRules[key].onPushAsync(item, key, this)
		else if (this.globalRules.onPush) await this.globalRules.onPush(item, key, this)
		else if (this.globalRules.onPushAsync) await this.globalRules.onPushAsync(item, key, this)

		this.firstItemPushed = true



		this.storage.push(key, {
			pushTimestamp: Date.now(),
			value: this._gzip ?
				await this.gzipItemString(JSON.stringify(item)) : 
				Buffer.from(JSON.stringify(item))
		})
	}

	private async flushItemFromQueue(key: string, item: T, callback: ExecCallback<T>) {
		if (this._logger) console.log(new Date(), `#> flushed item - queue: ${this.name} - key: ${key}`)

		const maxRetry = 
			this.keyRules[key].maxRetry || 
			this.globalRules.maxRetry || 
			1

		let onMaxRetryCallback: OnMaxRetryCallback<T>
		let isMaxRetryCallbackAsync: boolean = false

		if (this.keyRules[key].onMaxRetry) {
			onMaxRetryCallback = this.keyRules[key].onMaxRetry
			isMaxRetryCallbackAsync = true
		} else if (this.keyRules[key].onMaxRetryAsync) {
			onMaxRetryCallback = this.keyRules[key].onMaxRetryAsync
			isMaxRetryCallbackAsync = false
		} else if (this.globalRules.onMaxRetry) {
			onMaxRetryCallback = this.globalRules.onMaxRetry
			isMaxRetryCallbackAsync = true
		} else if (this.globalRules.onMaxRetryAsync) {
			onMaxRetryCallback = this.globalRules.onMaxRetryAsync
			isMaxRetryCallbackAsync = false
		} else onMaxRetryCallback = ((_, error) => { throw error })

		let retryCount = 0
		while (retryCount < maxRetry) {
			try {
				if (this._logger && retryCount > 0) console.log(new Date(), `#> retrying item flush - queue: ${this.name} - key: ${key} - #`, retryCount)
				await callback(item, key, this)
				break
			} catch (error) {
				retryCount++
				if (retryCount >= maxRetry) {
					if (isMaxRetryCallbackAsync) onMaxRetryCallback(error, item, key, this)
					else await onMaxRetryCallback(error, item, key, this)
					break
				}
			}
		}
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
	setDelay(key: string, delay: number) {
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
	 * @param keys - provide a key (* refers to all keys)
	 * @param condition - if returns true, the item is ignored*/
	ignoreItem(key: string, condition: IgnoreItemCondition<T>) {
		this.parseKey(key)
		this.setRule(key, "ignoreItemCondition", condition)
		return this
	}

	/**Set a maximum retry number if the flush callback throws an error
	 * @param key - provide a key (* refers to all keys)
	 * @param max - number of retries*/
	setMaxRetry(key: string, max: number = 1) {
		this.parseKey(key)
		this.setRule(key, "maxRetry", max)
		return this
	}

	/**Set a callback for when the maximum retry number has been reached
	 * @param key - provide a key (* refers to all keys)
	 * @param callback - max retry callback (throw the last retry error by default)*/
	onMaxRetry(key: string, callback: OnMaxRetryCallback) {
		this.parseKey(key)
		this.setRule(key, "onMaxRetryAsync", undefined)
		this.setRule(key, "onMaxRetry", callback)
		return this
	}

	/**Set a callback for when the maximum retry number has been reached
	 * @param key - provide a key (* refers to all keys)
	 * @param callback - max retry callback (throw the last retry error by default)*/
	onMaxRetryAsync(key: string, callback: OnMaxRetryCallback) {
		this.parseKey(key)
		this.setRule(key, "onMaxRetry", undefined)
		this.setRule(key, "onMaxRetryAsync", callback)
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
	private async parseItemsPost(key: string, items: QueueItem[]): Promise<QueueItemParsed<T>[]> {
		let clonesNum: number
		let cloneCondition: CloneCondition<T>

		if (this.keyRules[key].clonePost) {
			clonesNum = this.keyRules[key].clonePost
			cloneCondition = this.keyRules[key].clonePostCondition
		} else if (this.globalRules.clonePost) {
			clonesNum = this.globalRules.clonePost
			cloneCondition = this.globalRules.clonePostCondition
		}

		const parsedItems: QueueItemParsed<T>[] = []

		for (let item of items) 
			parsedItems.push(await this.parseQueueItem(item))
		

		if (!clonesNum) return parsedItems
		else return parsedItems.flatMap(i => {
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

	/**Set a Redis storage
	 * @param redis - provide an ioredis client*/
	redisStorage(redis: Redis) {
		this.storage = new RedisStorage(this.name, redis)
		return this
	}

	/**Set an in Memory storage (default)*/
	inMemoryStorage() {
		this.storage = new MemoryStorage(this.name)
		return this
	}

	logger(enabled: boolean) {
		this._logger = enabled
		return this
	}

	setFlushRate(rate: number) {
		this.shiftRate = 1000 / rate
		return this
	}

	/**Enable items gzipping before pushing them to the storage (disabled by default). 
	 * It's not allowed to set gzipping if the first item has already been pushed to the queue.*/
	gzip() {
		if (this.firstItemPushed) throw Error("cannot set gzip because an item has already been pushed to the queue")
		this._gzip = true
		return this
	}

	private async gzipItemString(item: string): Promise<Buffer> {
		return await gzip(item)
	}

	private async ungzipItemString(gzipped: Buffer): Promise<string> {
		const buffer = await ungzip(Buffer.from(gzipped))
		return buffer.toString()
	}

	private async parseQueueItem(item: QueueItem): Promise<QueueItemParsed<T>> {
		let parsedItem: QueueItemParsed<T> = (item as unknown) as QueueItemParsed<T> 

		try {
			let toBeParsed
			if (this._gzip) toBeParsed = await this.ungzipItemString(item.value)
			parsedItem.value = JSON.parse(toBeParsed)
			return parsedItem
		} catch (err) {
			// console.log(err)
			// console.log(Buffer.from(item.value).toString())
			parsedItem.value = JSON.parse(Buffer.from(item.value).toString()) as T
			return parsedItem
		}
	} 
}