import { QueueItem, StoredCount } from "../types"
import { Redis, RedisOptions } from "ioredis"
import { Storage } from "./Storage"

export class RedisStorage extends Storage {
	private redis: Redis
	private keyHead: string
	private keySetTail = "§$et§"

	private timestampsCache: number[] = []

	constructor(name: string, redisOptions: RedisOptions, TTLms: number) {
		super(name, TTLms)
		this.redis = new Redis(redisOptions)
		this.redis.on("error", (err) => { throw err })
		this.keyHead = "n§çs§çq-" + name
	}

	async push(key: string, item: QueueItem): Promise<void> {
		if (this.TTLms) await this.pushTTL(key, item) 
		else await this.pushNoTTL(key, item)
	}

	private async pushTTL(key: string, item: QueueItem) {
		this.timestampsCache.push(item.pushTimestamp)
		this.runTTLCleanup()
		await this.redis.zadd(this.buildListKey(key), item.pushTimestamp, JSON.stringify(item))		
	}

	private async pushNoTTL(key: string, item: QueueItem) {
		await this.redis.lpush(this.buildListKey(key), JSON.stringify(item));
	}

	async popRight(key: string, count: number): Promise<QueueItem[]> {
		if (this.TTLms) return await this.popRightTTL(key, count)
		else return await this.popRightNoTTL(key, count)
	}

	private async popRightNoTTL(key: string, count: number): Promise<QueueItem[]> {
		const items: QueueItem[] = []

		for (let i = 0; i < count; i++) {
			const item = await this.redis.rpop(this.buildListKey(key))
			if (item) items.push(JSON.parse(item))
		}

		return items
	}

	/**FIFO: gets the lowest score (oldest) elements*/
	async popRightTTL(key: string, count: number): Promise<QueueItem[]> {
		const redisKey = this.buildListKey(key) 
		// 0 to 0 is the first element, so count - 1
		const items = (await this.redis.zrange(redisKey, 0, count - 1)).map(r => JSON.parse(r)) as QueueItem[]
		await this.redis.zremrangebyrank(redisKey, 0, count - 1)
		return items
	}

	async popLeft(key: string, count: number): Promise<QueueItem[]> {
		if (this.TTLms) return await this.popLeftTTL(key, count)
		else return await this.popLeftNoTTL(key, count)
	}

	async popLeftNoTTL(key: string, count: number): Promise<QueueItem[]> {
		const items: QueueItem[] = []

		for (let i = 0; i < count; i++) {
			const item = await this.redis.lpop(this.buildListKey(key))
			if (item) items.push(JSON.parse(item))
		}

		return items
	}

	/**LIFO: gets the higher score (youngest) elements*/
	async popLeftTTL(key: string, count: number): Promise<QueueItem[]> {
		const redisKey = this.buildListKey(key)
		const items = (await this.redis.zrange(redisKey, 0, count - 1, "REV")).map(r => JSON.parse(r)) as QueueItem[]
		await this.redis.zremrangebyrank(redisKey, count * (-1), -1)
		return items
	}

	async getStoredCount(): Promise<StoredCount> {
		const storedCount: StoredCount = {}

		const keys = await this.redis.keys(this.keyHead + "*")

		// if (this.TTLms) {
		for (const key of keys) {
			if (!key.startsWith(this.keyHead)) continue
			if (this.TTLms) {
				try {
					storedCount[this.getItemKey(key)] = await this.redis.zcount(key, '-inf', 'inf')
				} catch (err) {
					if (err.message.includes("WRONGTYPE")) continue

				}
			} else storedCount[this.getItemKey(key)] = await this.redis.llen(key)
		}	

		return storedCount
	}

	private buildListKey(key: string) {
		return this.TTLms ? 
			this.keyHead + key + this.keySetTail :
			this.keyHead + key
	}

	private getItemKey(redisKey: string) {
		return this.TTLms ?
			redisKey.split(this.keyHead)[1].split(this.keySetTail)[0] :
			redisKey.split(this.keyHead)[1]
	}

	// private runTTLCleanup() {
	// 	if (!this.TTLms) return
	// 	if (this.TTLtimer) return

	// 	let threshold: number
	// 	let timer: number 
	// 	do {
	// 		threshold = this.timestampsCache.shift()
	// 		if (!threshold) return
	// 		timer = (Date.now() - (threshold + this.TTLms)) * -1
	// 	} while (timer < 0)

	// 	this.TTLtimer = setTimeout(() => {
	// 		this.TTLtimer = undefined
	// 		this.cleanupKeys(threshold)
	// 		this.runTTLCleanup()
	// 	}, timer)
	// }

	protected async getFirstTimestamp(): Promise<number> {
		return this.timestampsCache.shift()
	}

	protected async cleanupKeys(threshold: number): Promise<number> {
		if (!this.TTLms) return

		let count = 0 

		const keys = await this.redis.keys(this.keyHead + "*")
		for (const key of keys) {
			if (!key.startsWith(this.keyHead)) continue
			if (!key.endsWith(this.keySetTail)) continue
			const removed = await this.redis.zremrangebyscore(key, '-inf', `${threshold}`)
			count += removed
		}

		return count
	}
	
}