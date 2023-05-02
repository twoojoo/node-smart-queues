import { QueueItem, StoredCount, TTLOptions } from "../types"
import { Redis, RedisOptions } from "ioredis"
import { deleteRedisKeys } from "./RedisList"
import { Storage } from "./Storage"

export class RedisSetStorage extends Storage {
	private redis: Redis
	private keyHead: string
	private TTLkey: string

	static keySetTail = "§$et§"
	static keyTTLTail = "§$ttl§"

	constructor(name: string, redisOptions: RedisOptions & TTLOptions) {
		super(name, redisOptions.TTLms)
		this.redis = new Redis(redisOptions)
		this.redis.on("error", (err) => { throw err })
		this.keyHead = "n§çs§çq-rset-" + name
		this.TTLkey = "n§çs§çq-rset" + name + RedisSetStorage.keyTTLTail
		this.runTTLCleanup({ forceThreshold: true })
	}
	
	async push(key: string, item: QueueItem) {
		await this.redis.lpush(this.TTLkey, `${item.pushTimestamp}`)
		this.runTTLCleanup()
		await this.redis.zadd(this.buildListKey(key), item.pushTimestamp, JSON.stringify(item))		
	}

	/**FIFO: gets the lowest score (oldest) elements*/
	async popRight(key: string, count: number): Promise<QueueItem[]> {
		const redisKey = this.buildListKey(key) 
		// 0 to 0 is the first element, so count - 1
		const items = (await this.redis.zrange(redisKey, 0, count - 1)).map(r => JSON.parse(r)) as QueueItem[]
		await this.redis.zremrangebyrank(redisKey, 0, count - 1)
		return items
	}

	/**LIFO: gets the higher score (youngest) elements*/
	async popLeft(key: string, count: number): Promise<QueueItem[]> {
		const redisKey = this.buildListKey(key)
		const items = (await this.redis.zrange(redisKey, 0, count - 1, "REV")).map(r => JSON.parse(r)) as QueueItem[]
		await this.redis.zremrangebyrank(redisKey, count * (-1), -1)
		return items
	}

	async getStoredCount(): Promise<StoredCount> {
		const storedCount: StoredCount = {}

		const keys = await this.redis.keys(this.keyHead + "*")

		for (const key of keys) {
			if (!key.startsWith(this.keyHead)) continue
			try {
				storedCount[this.getItemKey(key)] = await this.redis.zcount(key, '-inf', 'inf')
			} catch (err) {
				if (err.message.includes("WRONGTYPE")) continue
				throw err
			}
		}	

		return storedCount
	}

	private buildListKey(key: string) {
		return this.keyHead + key + RedisSetStorage.keySetTail
	}

	private getItemKey(redisKey: string) {
		return redisKey.split(this.keyHead)[1].split(RedisSetStorage.keySetTail)[0]
	}

	protected async getFirstTimestamp(): Promise<number> {
		const ts = parseInt(await this.redis.rpop(this.TTLkey))
		if (isNaN(ts)) return undefined
		else return ts
	}

	protected async cleanupKeys(threshold: number): Promise<number> {
		if (!this.TTLms) return

		let count = 0 

		const keys = await this.redis.keys(this.keyHead + "*")
		for (const key of keys) {
			if (!key.startsWith(this.keyHead)) continue
			if (!key.endsWith(RedisSetStorage.keySetTail)) continue
			const removed = await this.redis.zremrangebyscore(key, '-inf', `${threshold}`)
			count += removed
		}

		return count
	}
	
	async flush(...keys: string[]): Promise<void> {
		let redisKeys = await this.redis.keys(this.keyHead + "*")
		await deleteRedisKeys(redisKeys, keys)
	}
}