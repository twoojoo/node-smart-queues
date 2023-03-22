import { CallbackOptions, ExecCallback, IgnoreItemCondition, OnMaxRetryCallback, OnPushCallback, PriorityOptions, PushOptions, PushResult, QueueItem, QueueItemParsed, QueueMode, QueueStaticOptions, Rules, StoredCount } from "./types"
import { ALL_KEYS_CH, DEFAULT_SHIFT_RATE } from "./constants"
import { inMemoryStorage } from "./storage"
import { Storage } from "./storage/Storage"
import { registerNewQueue } from "./pool"
import { gzip, ungzip } from "node-gzip"
import { shuffleArray } from "./utils"

export class Queue<T = any> {
	// static options
	private storage: Storage = undefined
	private loopRate: number = 1000 / DEFAULT_SHIFT_RATE
	private gzip: boolean = false
	private logger: boolean = true

	// dynamic options
	private name: string

	// loop control
	private alreadyStartedOnce: boolean = false
	private mainInterval: NodeJS.Timer = undefined 
	private looping: boolean = false
	private paused: boolean = false
	private loopLocked: boolean = true

	// priority / ignore
	private priorities: string[] = []
	private randomized: boolean = false
	private ignoreNotPrioritized: boolean = false
	private keysToIgnore: string[] = []

	// rules
	private globalRules: Rules<T> = {}
	private keyRules: { [key: string]: Rules<T> } = {}

	constructor(name: string, options: QueueStaticOptions = {}) {
		this.name = name
		this.storage = options?.storage?.(name) || inMemoryStorage()(name)
		this.gzip = options.gzip || false
		this.loopRate = (options.loopRate || DEFAULT_SHIFT_RATE) / 1000
		registerNewQueue(this)
	}

	/// STATIC PROPERTIES
	
	/**Returns the name of the queue*/
	getName() { return this.name }

	// LOOP CONTROL

	/** ignoreNotPrioritized affects pushed item only */
	private calculatePriority(): string[] {
		const knownKeys = Object.keys(this.keyRules)
		if (this.randomized) return shuffleArray(knownKeys)
		const notPrioritized = knownKeys.filter(key => !this.priorities.includes(key))
		return this.priorities.concat(notPrioritized) 
	}

	/**Look in the storage for keys that still have some pending items*/
	private async recover() {
		if (!this.alreadyStartedOnce) { //only the first time
			this.log(`recovering pending items from storage`)

			const storedCount = await this.storage.getStoredCount()

			let recoverCount = 0
			const knownKeys = Object.keys(this.keyRules)
			for (let [key, count] of Object.entries(storedCount)) {
				if (!knownKeys.includes(key)) this.keyRules[key] = this.defaultKeyRules()
				this.loopLocked = false
				recoverCount += count
			}

			this.alreadyStartedOnce = true
			this.log(`recovered ${recoverCount} items from storage`)
		}
	}

	private async startLoop() {
		if (this.looping) return
		this.looping = true

		clearInterval(this.mainInterval)

		await this.recover()

		this.mainInterval = setInterval(async () => {
			const start = Date.now()

			if (this.paused) {
				clearInterval(this.mainInterval)
				return
			}

			if (this.loopLocked) return
			//kill any other interval callback while
			//the current one is active
			this.loopLocked = true

			for (const key of this.calculatePriority()) {
				const keyRules = this.keyRules[key] || {}

				//skip the key if a pop callback is not provided 
				//(maybe remove this feature and just pop)
				if (!keyRules.onPop && !this.globalRules.onPop) continue

				//if the key is locked (due to delay) check if the delay is expired.
				//If so unlock key and go on, else coninue to the next key
				if (keyRules.locked) {
					const delaySize = keyRules.delay || this.globalRules.delay
					if ((Date.now() - keyRules.lastLockTimestamp) >= delaySize) this.unlockKey(key)
					else continue
				}

				//get the number of items to pop
				const popSize = keyRules.popSize || this.globalRules.popSize || 1

				//pop items
				const items = this.getPopModeIternal(key) == "FIFO" ?
					await this.storage.popRight(key, popSize) : 
					await this.storage.popLeft(key, popSize)

				if (items.length > 0) {
					if (keyRules.delay || this.globalRules.delay) this.lockKey(key)

					for (let item of items) {
						const pItem = await this.parseQueueItem(item)
						// get the correct calòback to execute (and if must be awaited or not)
						if (keyRules.onPop && !keyRules.onPopAwait) this.popItemFromQueue(key, pItem.value, keyRules.onPop, start)
						else if (keyRules.onPop && keyRules.onPopAwait) await this.popItemFromQueue(key, pItem.value, keyRules.onPop, start)
						else if (this.globalRules.onPop && !this.globalRules.onPopAwait) await this.popItemFromQueue(key, pItem.value, this.globalRules.onPop, start)
						else if (this.globalRules.onPop && this.globalRules.onPopAwait) this.popItemFromQueue(key, pItem.value, this.globalRules.onPop, start)
					}

					// unlock the loop only if there the 
					// queue is completely empty
					const storedCount = await this.getStorageCount();
					for (let count of Object.values(storedCount)) {
						if (count != 0) this.loopLocked = false
					}
 
					//break the loop any time something is popped
					//to force a priorities recalculation
					break
				}
			}
		}, this.loopRate)
		this.looping = false
	}

	/**make the loop skip a key*/
	private lockKey(key: string) {
		this.keyRules[key].locked = true
		this.keyRules[key].lastLockTimestamp = Date.now()
	}

	/**remove the key lock*/
	private unlockKey(key: string) {
		this.keyRules[key].locked = false
		this.keyRules[key].lastLockTimestamp = undefined
	}

	/**Starts the queue*/
	start() {
		this.log(`starting queue`, this.name)
		this.paused = false
		if (!this.looping) this.startLoop()
		return this
	}


	/** Pause the queue (pause indefinitely if timer is not provided)
	 * @param timer - set a timer for the queue restart (calls start() after the timer has expiret)*/
	pause(timer?: number) {
		this.log(`pausing queue`, this.name, timer ? `for ${timer}ms` : "indefinitely")

		this.paused = true
		this.looping = false
		if (timer || timer == 0) setTimeout(() => this.start(), timer)

		return this
	}

	/// CALLBACKS

	/**Set a callback to be executed syncronously (awaited if async) when pushing items for a specific key
	* @param key - provide a key (* refers to all keys)
	* @param callback - (item, key?, queue?) => { ..some action.. } [can be async]*/
	onPush(key: string, callback: OnPushCallback<T>, options: CallbackOptions) {
		this.parseKey(key)
		this.setRule(key, "onPush", callback)
		this.setRule(key, "onPushAwait", options.awaited)
		return this
	}

	/**Push an item in the queue for a certain key
	 * @param key - provide a key (* refers to all keys and will throw an error when used as a key)
	 * @param item - item to be pushed in the queue
	 * @returns true if the item wasn't ignored by the queue
	 * */
	async push(key: string, item: T, options: PushOptions = {}): Promise<PushResult> {
		try {
			const pushTimestamp = Date.now()

			if (key == ALL_KEYS_CH) throw Error(`"*" character cannot be used as a key (refers to all keys)`)

			//check if the key is to be ignored
			if (this.keysToIgnore.includes(key)) 
				return { pushed: false, message: `key "${key}" is ignored by the queue` }

			//check if the key is not prioritized and should be skipped
			if (this.ignoreNotPrioritized) 
				if (!this.priorities.includes(key))
					return { pushed: false, message: `key "${key}" is not prioritized` }

			this.parseKey(key)

			//check if there is a condition for the item to 
			//be ignored and calculate the condition result
			const ignoreItemCondition = 
				this.keyRules[key].ignoreItemCondition || 
				this.globalRules.ignoreItemCondition

			if (ignoreItemCondition)
				if (ignoreItemCondition(item))
					return { pushed: false, }

			await this.pushItemInStorage(key, item, pushTimestamp)

			this.loopLocked = false
			this.startLoop()
			return { pushed: true }

		} catch (error) {
			if (options.throwErrors !== false) throw error
			else return {
				pushed: false,
				message: "an error has occurred",
				error
			}
		}
	}

	/**Push an item to the storage after executin onPush hooks if they exist*/
	private async pushItemInStorage(key: string, item: T, pushTimestamp: number) {
		if (this.keyRules[key].onPush && this.keyRules[key].onPushAwait) 
			await this.keyRules[key].onPush(item, key, this)

		else if (this.keyRules[key].onPush) 
			this.keyRules[key].onPush(item, key, this)

		else if (this.globalRules.onPush && this.globalRules.onPushAwait) 
			await this.globalRules.onPush(item, key, this)

		else if (this.globalRules.onPush) 
			this.globalRules.onPush(item, key, this)

		this.storage.push(key, {
			pushTimestamp,
			value: this.gzip ?
				await this.gzipItemString(JSON.stringify(item)) : 
				Buffer.from(JSON.stringify(item))
		})

		this.log(`pushed item - queue: ${this.name} - key: ${key} [${Date.now() - pushTimestamp}ms]`)
	}

	private async popItemFromQueue(key: string, item: T, callback: ExecCallback<T>, start: number) {
		const maxRetry = this.keyRules[key].maxRetry || this.globalRules.maxRetry || 1

		let onMaxRetryCallback: OnMaxRetryCallback<T>
		let awaitMaxRetryCallback: boolean

		if (this.keyRules[key].onMaxRetry) {
			onMaxRetryCallback = this.keyRules[key].onMaxRetry
			awaitMaxRetryCallback = this.keyRules[key].onMaxRetryAwait === false ? false : true
		} else if (this.globalRules.onMaxRetry) {
			onMaxRetryCallback = this.globalRules.onMaxRetry
			awaitMaxRetryCallback = this.globalRules.onMaxRetryAwait === false ? false : true
		} else { 
			onMaxRetryCallback = ((_, error) => { throw error })
			awaitMaxRetryCallback = true
		}
		
		let retryCount = 0
		while (retryCount < maxRetry) {
			try {
				this.log(`flushed item - queue: ${this.name} - key: ${key} [${Date.now() - start}ms]`)
				await callback(item, key, this)
				break
			} catch (error) {
				if (retryCount > 0) this.log(`retrying item flush - queue: ${this.name} - key: ${key} - #`, retryCount)
				retryCount++
				if (retryCount >= maxRetry) {
					if (awaitMaxRetryCallback) await onMaxRetryCallback(error, item, key, this)
					else onMaxRetryCallback(error, item, key, this)
					break
				}
			}
		}
	}

	/**Set FIFO behaviour (default). If a key is provided the behaviour is applied to that key and overrides the queue global behaviour for that key
	 * @param key - provide a key (* refers to all keys)*/
	setFIFO(key: string = "*") {
		this.parseKey(key)
		this.setRule(key, "mode", "FIFO")
		return this
	}

	/**Set LIFO behaviour. If a key is provided the behaviour is applied to that key and overrides the queue global behaviour for that key
	 * @param key - provide a key (* refers to all keys)*/
	setLIFO(key: string = "*") {
		this.parseKey(key)
		this.setRule(key, "mode", "LIFO")
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
	onPop(key: string, callback: ExecCallback<T>, options: CallbackOptions = {}) {
		this.parseKey(key)
		this.setRule(key, "onPop", callback)
		this.setRule(key, "onPopAwait", options.awaited === false ? false : true)
		return this
	}

	/**Set the number of items to flush at one time (the exec calback is called once for each item separately)
	* @param key - provide a key (* refers to all keys)
	* @param size - flush size*/
	popSize(key: string, size: number) {
		this.parseKey(key)
		this.setRule(key, "popSize", size)
		this.log(`set pop size: ${size} - queue ${this.name}`, key == ALL_KEYS_CH ? "" : `- key ${key}`)
		return this
	}

	/**Set the number of milliseconds that the queue has to wait befor flushing again for a specific key (net of flush execution time)
	* @param key - provide a key (* refers to all keys)
	* @param delay - milliseconds*/
	delay(key: string, delay: number) {
		this.parseKey(key)
		this.setRule(key, "delay", delay)
		this.log(`${delay}ms delay set - queue ${this.name}`, key == ALL_KEYS_CH ? "" : `- key ${key}`)
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
	ignoreItems(key: string, condition: IgnoreItemCondition<T>) {
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
		if (!this.keyRules[key]) this.keyRules[key] = this.defaultKeyRules()
		return false
	}

	/**Key kind overrides queue kind*/
	private getPopModeIternal(key: string): QueueMode {
		if (key == ALL_KEYS_CH) return this.globalRules.mode
		if (this.keyRules[key].mode == "FIFO") return "FIFO"
		if (this.keyRules[key].mode == "LIFO") return "LIFO"
		if (this.globalRules.mode) this.globalRules.mode
		else return "FIFO"
	}

	private setRule(key: string, rule: string, value: any) {
		if (!rule) return
		if (key == ALL_KEYS_CH) this.globalRules[rule] = value
		else this.keyRules[key][rule] = value
	}

	private defaultKeyRules(): Rules<T> {
		return {}
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

	async getStorageCount(): Promise<StoredCount> {
		return await this.storage.getStoredCount()
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
			if (this.gzip) toBeParsed = await this.ungzipItemString(item.value)
			parsedItem.value = JSON.parse(toBeParsed)
			return parsedItem
		} catch (err) {
			// console.log(err)
			// console.log(Buffer.from(item.value).toString())
			parsedItem.value = JSON.parse(Buffer.from(item.value).toString()) as T
			return parsedItem
		}
	} 

	getPopMode(key: string = ALL_KEYS_CH): { [key: string]: QueueMode } | QueueMode {
		if (key == ALL_KEYS_CH) {
			const modeByKey: { [key: string]: QueueMode } = {}

			const defaultMode = this.globalRules.mode || "FIFO"

			for (const [key, values] of Object.entries(this.keyRules)) {
				modeByKey[key] = values.mode || defaultMode
			}

			modeByKey["*"] = defaultMode

			return modeByKey
		} else {
			if (this.keyRules[key]?.mode) return this.keyRules[key]?.mode
			if (this.globalRules.mode) return this.globalRules.mode
			return "FIFO"
		}
	}

	log(...args: any[]) {
		if (this.logger) console.log(new Date(), `#>`, ...args)
	}
}