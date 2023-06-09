import { DEFAULT_SHIFT_RATE } from "./constants"
import { inMemoryStorage } from "./storage"
import { Storage } from "./storage/Storage"
import { registerNewQueue } from "./pool"
import { gzip, ungzip } from "node-gzip"
import { shuffleArray } from "./utils"

import {
	OnMaxRetryCallback,
	EnqueueResultCode,
	QueueItemParsed,
	EnqueueOptions, 
	EnqueueResult, 
	GlobalOptions,
	ExecCallback, 
	QueueOptions, 
	GlobalRules, 
	StoredCount, 
	KeyOptions,
	QueueItem,
	QueueMode,
	KeyRules, 
} from "./types"


export class Queue<T = any> {
	// static options
	private storage: Storage = undefined
	private loopRate: number = 1000 / DEFAULT_SHIFT_RATE
	private gzip: boolean = false
	private logger: boolean = true

	// loop control
	private mainInterval: NodeJS.Timer = undefined 
	private looping: boolean = false
	private paused: boolean = false
	private loopLocked: boolean = true
	private storedJobs: number = 0

	// rules
	private globalRules: GlobalRules<T> = {}
	private keyRules: { [key: string]: KeyRules<T> } = {}

	constructor(private name: string, options: QueueOptions<T> = {}) {
		this.storage = options?.storage?.(name) || inMemoryStorage()(name)
		this.gzip = options.gzip || false
		this.loopRate = (options.loopRate || DEFAULT_SHIFT_RATE) / 1000
		this.globalRules = options
		registerNewQueue(this)
	}
	
	/**Returns the name of the queue*/
	getName() { return this.name }

	log(...args: any[]) {
		if (this.logger) console.log(new Date(), `# nsq # [${this.name}]`, ...args)
	}

	/**Set options for the entire queue*/
	options(options: GlobalOptions<T>) {
		this.globalRules = { ...this.globalRules, ...options }
		return this
	}

	/**Set options for a specific key
	 * @note specific options override global options 
	 * @note if an options isn't provided the queue will fallback to the correspondany global option*/
	key(key: string, options: KeyOptions<T>) {
		if (this.keyRules[key]) this.keyRules[key] = {}
		this.keyRules[key] = { ...this.keyRules[key], ...options }
		return this
	}

	// LOOP CONTROL

	/** ignore and ignoreNotPrioritized affects pushed item only */
	private calculatePriority(): string[] {
		const knownKeys = Object.keys(this.keyRules).filter(k => !this.keyRules[k].blocked)
		if (this.globalRules.randomPriority) return shuffleArray(knownKeys)
		const notPrioritized = knownKeys.filter(key => !(this.globalRules.priority || []).includes(key))
		return (this.globalRules.priority || []).concat(notPrioritized) 
	}

	/**Look in the storage for keys that still have some pending items*/
	private async recover() {
		this.log(`recovering pending items from storage`)

		const storedCount = await this.storage.getStoredCount()

		let recoverCount = 0
		const knownKeys = Object.keys(this.keyRules)
		for (let [key, count] of Object.entries(storedCount)) {
			if (!knownKeys.includes(key)) this.keyRules[key] = this.defaultKeyRules()
			this.loopLocked = false
			recoverCount += count
		}

		this.storedJobs += recoverCount			
		this.log(`recovered ${recoverCount} items from storage`)
	}

	private async startLoop() {
		if (this.looping) return
		this.looping = true

		//prevent multiple running intervals
		clearInterval(this.mainInterval)

		//recover sotred jobs anytime the queue is restarted
		await this.recover()

		//spin up interval
		this.mainInterval = setInterval(async () => {
			const start = Date.now()

			//Stop interval if queue is paused
			//Reset stored jobs counter since new recover will be executed when queue is restarted
			if (this.paused) {
				this.storedJobs = 0
				clearInterval(this.mainInterval)
				return
			}

			//close iteration if no stored jobs
			if (this.storedJobs < 0) this.storedJobs = 0 //fix any error
			if (this.storedJobs == 0) return

			//kill iteration if an iteration is still running
			if (this.loopLocked) return
			this.loopLocked = true

			//kill iteration if storace is not yet initialized
			if (!this.storage.initialized) return

			//process all keys in a certain order
			for (const key of this.calculatePriority()) {
				const keyRules = this.keyRules[key] || {}

				//skip the key if an onDequeue hook is not provided (maybe remove this feature and just pop)
				if (!keyRules.onDequeue && !this.globalRules.onDequeue) continue

				//if the key is locked (due to interval) check if the interval is expired. If so unlock key and go on, else coninue to the next key
				if (keyRules.locked) {
					const intervalSize = keyRules.minInterval || this.globalRules.minInterval
					if ((Date.now() - keyRules.lastLockTimestamp) >= intervalSize) this.unlockKey(key)
					else continue
				}

				//get the number of items to pop
				const dequeueSize = keyRules.dequeueSize || this.globalRules.dequeueSize || 1

				//dequeue items
				const items = this.getPopModeIternal(key) == "FIFO" ?
					await this.storage.popRight(key, dequeueSize) : //FIFO
					await this.storage.popLeft(key, dequeueSize) //LIFO

				//exit loop if any item gets processed to force a priority recalculation
				if (items.length > 0) {
					await this.processDequeuedItems(items, key, keyRules, start)
					break 
				}				
			}
			
			this.loopLocked = false 
		}, this.loopRate)

		this.looping = false
	}

	/**Process each dequeued item deciding if it has to be run asyncronously and what callback must be used*/
	private async processDequeuedItems(items: QueueItem[], key: string, keyRules: KeyRules<T>, start: number) {
		if (keyRules.minInterval || this.globalRules.minInterval) this.lockKey(key)

		for (let item of items) {
			const pItem = await this.parseQueueItem(item)

			// get the correct callback to execute (and if must be awaited or not)
			if (keyRules.onDequeue && !keyRules.onDequeueAwaited) {
				this.popItemFromQueue(key, pItem.value, keyRules.onDequeue, start)
			} else if (keyRules.onDequeue && keyRules.onDequeueAwaited) {
				await this.popItemFromQueue(key, pItem.value, keyRules.onDequeue, start) 
			} else if (this.globalRules.onDequeue && !this.globalRules.onDequeueAwaited) {
				await this.popItemFromQueue(key, pItem.value, this.globalRules.onDequeue, start)
			} else if (this.globalRules.onDequeue && this.globalRules.onDequeueAwaited) {
				this.popItemFromQueue(key, pItem.value, this.globalRules.onDequeue, start)
			}
		}
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

		if (timer || timer == 0) {
			setTimeout(() => this.start(), timer)
		}

		return this
	}

	/**Push an item in the queue for a certain key
	 * @param key - provide a key (* refers to all keys and will throw an error when used as a key)
	 * @param item - item to be pushed in the queue */
	async enqueue(key: string, item: T, options: EnqueueOptions = {}): Promise<EnqueueResult> {
		try {
			const pushTimestamp = Date.now()

			//check if the key is to be ignored
			if (this.globalRules.ignore?.includes(key))
				return { 
					enqueued: false, 
					code: EnqueueResultCode.KeyIgnored,
					message: `key "${key}" is being ignored` 
				}

			//check if the key is not prioritized and should be skipped
			if (this.globalRules.ignoreNotPrioritized) 
				if (!this.globalRules.priority.includes(key))
					return { 
						enqueued: false, 
						code: EnqueueResultCode.KeyNotPrioritized,
						message: `key "${key}" is not prioritized`
					}

			if (!this.keyRules[key]) this.keyRules[key] = this.defaultKeyRules()

			//check if there is a condition for the item to 
			//be ignored and calculate the condition result
			const ignoreItemOn = 
				this.keyRules[key].ignoreItemOn || 
				this.globalRules.ignoreItemOn

			if (ignoreItemOn)
				if (ignoreItemOn(item))
					return { 
						enqueued: false, 
						code: EnqueueResultCode.MissingCondition,
						message: `item for key "${key}" doesn't satisfy the condition`
					}

			await this.pushItemInStorage(key, item, pushTimestamp)

			this.loopLocked = false
			this.storedJobs++

			return { 
				enqueued: true, 
				message: `item enqueued for key "${key}"`,
				code: EnqueueResultCode.Enqueued
			}
		} catch (error) {
			if (options.throwErrors !== false) throw error
			else return {
				enqueued: false,
				code: EnqueueResultCode.ErrorOccurred,
				message: `an error occurred for key "${key}"`,
				error
			}
		}
	}

	/**Push an item to the storage after executin onPush hooks if they exist*/
	private async pushItemInStorage(key: string, item: T, pushTimestamp: number) {
		this.storage.push(key, {
			pushTimestamp,
			value: this.gzip ?
				await this.gzipItemString(JSON.stringify(item)) : 
				Buffer.from(JSON.stringify(item))
		})

		this.log(`[${key}] enqueue item [${Date.now() - pushTimestamp}ms]`)
	}

	private async popItemFromQueue(key: string, item: T, callback: ExecCallback<T>, start: number) {
		const maxRetry = this.keyRules[key].maxRetry || this.globalRules.maxRetry || 1

		let onMaxRetryCallback: OnMaxRetryCallback<T>
		let awaitMaxRetryCallback: boolean

		if (this.keyRules[key].onMaxRetry) {
			onMaxRetryCallback = this.keyRules[key].onMaxRetry
			awaitMaxRetryCallback = this.keyRules[key].onMaxRetryAwaited === false ? false : true
		} else if (this.globalRules.onMaxRetry) {
			onMaxRetryCallback = this.globalRules.onMaxRetry
			awaitMaxRetryCallback = this.globalRules.onMaxRetryAwaited === false ? false : true
		} else { 
			onMaxRetryCallback = (error => { throw error })
			awaitMaxRetryCallback = true
		}
		
		let retryCount = 0
		while (retryCount < maxRetry) {
			try {
				this.log(`[${key}] dequeued item [${Date.now() - start}ms] (${this.getPopModeIternal(key)})`)
				await callback(item, key, this)
				break
			} catch (error) {
				if (retryCount > 0) this.log(`[${key}] retrying item dequeue - #`, retryCount)
				retryCount++
				if (retryCount >= maxRetry) {
					if (awaitMaxRetryCallback) await onMaxRetryCallback(error, item, key, this)
					else onMaxRetryCallback(error, item, key, this)
					break
				}
			}
		}

		this.storedJobs--
	}

	/**Ignores items pushed for the provided keys (dosen't override previously ignored key)
	 * @param keys - provide a list of keys (key * is forbidden)*/
	ignoreKeys(...keys: string[]) {
		if (Array.isArray(keys)) this.globalRules.ignore = Array.from(new Set((this.globalRules.ignore || []).concat(keys)))
		else this.globalRules.ignore = Array.from(new Set((this.globalRules.ignore || []).concat([keys])))
		return this
	} 

	restoreKeys(...keys: string[]) {
		if (Array.isArray(keys)) this.globalRules.ignore = this.globalRules.ignore.filter(k => !keys.includes(k))
		else this.globalRules.ignore = this.globalRules.ignore.filter(k => keys == k)
		return this
	}

	/**Key kind overrides queue kind*/
	private getPopModeIternal(key: string): QueueMode {
		if (this.keyRules[key].mode == "FIFO") return "FIFO"
		if (this.keyRules[key].mode == "LIFO") return "LIFO"
		if (this.globalRules.mode) return this.globalRules.mode
		else return "FIFO"
	}

	private defaultKeyRules(): KeyRules<T> {
		return {}
	}

	/**Tells if the queue is paused*/
	isPaused(): boolean {
		return this.paused
	}

	/**Tells if a key is ignored by the queue*/
	isKeyIgnored(key: string): boolean {
		return !!this.globalRules.ignore?.includes(key)
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
			parsedItem.value = JSON.parse(Buffer.from(item.value).toString()) as T
			return parsedItem
		}
	} 

	getDequeueMode(key?: string): { [key: string]: QueueMode } | QueueMode {
		if (!key) {
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

	/**Blocks the dequeuing of items belonging to the provided keys*/
	block(...keys: string[]) {
		keys.forEach(key => {
			if (!this.keyRules[key]) this.keyRules[key] = this.defaultKeyRules()
			this.keyRules[key].blocked = true 
		})

		return this
	}

	/**Unlocks both the previously blocked dequeuing of items belonging to the provided keys*/
	release(...keys: string[]) {
		keys.forEach(key => {
			if (!this.keyRules[key]) this.keyRules[key] = this.defaultKeyRules()
			this.keyRules[key].blocked = false 
		})

		return this
	}

	isBlocked(key: string): boolean {
		if (!this.keyRules[key]) this.keyRules[key] = this.defaultKeyRules()
		return !!this.keyRules[key].blocked
	} 

	/**Flush all items (or keys-specific itmes) in the queue WITHOUT dequeueing them*/
	async flush(...keys: string[]) {
		if (keys.length === 0) {
			this.log(`flushing all keys items`)
		} else {
			keys.forEach(k => this.log(`[${k}] flushing items`))
		}

		await this.storage.flush(...keys)
	}

	listKnownKeys() {
		return Object.keys(this.keyRules)
	}
}