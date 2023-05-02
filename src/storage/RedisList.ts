import { QueueItem, StoredCount } from "../types"
import { Redis, RedisOptions } from "ioredis"
import { Storage } from "./Storage"

export class RedisListStorage extends Storage {
	private redis: Redis
	private keyHead: string

	constructor(name: string, redisOptions: RedisOptions) {
		super(name, undefined)
		this.redis = new Redis(redisOptions)
		this.redis.on("error", (err) => { throw err })
		this.keyHead = "n§çs§çq-lst" + name
		this.initialized = true
	}

	async push(key: string, item: QueueItem) {
		await this.redis.lpush(this.buildListKey(key), JSON.stringify(item));
	}

	async popRight(key: string, count: number): Promise<QueueItem[]> {
		const items: QueueItem[] = []

		for (let i = 0; i < count; i++) {
			const item = await this.redis.rpop(this.buildListKey(key))
			if (item) items.push(JSON.parse(item))
		}

		return items
	}

	async popLeft(key: string, count: number): Promise<QueueItem[]> {
		const items: QueueItem[] = []

		for (let i = 0; i < count; i++) {
			const item = await this.redis.lpop(this.buildListKey(key))
			if (item) items.push(JSON.parse(item))
		}

		return items
	}

	async getStoredCount(): Promise<StoredCount> {
		const storedCount: StoredCount = {}

		const keys = await this.redis.keys(this.keyHead + "*")

		for (const key of keys) {
			if (!key.startsWith(this.keyHead)) continue
			storedCount[this.getItemKey(key)] = await this.redis.llen(key)
		}	

		return storedCount
	}

	private buildListKey(key: string) {
		return this.keyHead + key
	}

	private getItemKey(redisKey: string) {
		return redisKey.split(this.keyHead)[1]
	}

	protected async getFirstTimestamp(): Promise<number> {
		throw Error("redis lists are not supposed to use TTL")
	}

	protected async cleanupKeys(_: number): Promise<number> {
		throw Error("redis lists are not supposed to use TTL")
	}
	
	async flush(...keys: string[]): Promise<void> {
		let redisKeys = await this.redis.keys(this.keyHead + "*")

		for (const key of redisKeys) {
			const originalKey = this.getItemKey(key)
			if (keys.length !== 0 && !keys.includes(originalKey)) continue
			await this.redis.del(key)
		}
	}
}