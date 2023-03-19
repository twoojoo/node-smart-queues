import { registerNewStorage } from "../pool"
import { QueueItem, QueueKind, StorageShiftOutput, StoredCount } from "../types"
import { Storage } from "./Storage"
import { Redis } from "ioredis"

export class RedisStorage extends Storage {
	private redis: Redis
	private keyHead: string

	constructor(name: string, redis: Redis) {
		super(name)
		this.redis = redis
		this.keyHead = "n§çs§çq-" + name 
		registerNewStorage(this)
	}

	async push(key: string, item: QueueItem): Promise<void> {
		await this.redis.lpush(this.buildListKey(key), JSON.stringify(item));
	}

	async shiftFIFO(key: string, count: number): Promise<StorageShiftOutput> {
		const items: any[] = []

		for (let i = 0; i < count; i++) {
			const item = await this.redis.rpop(this.buildListKey(key))
			if (item) items.push(JSON.parse(item))
		}

		return {
			storedCount: await this.getStoredCount(),
			items
		}
	}

	async shiftLIFO(key: string, count: number): Promise<StorageShiftOutput> {
		const items: any[] = []

		for (let i = 0; i < count; i++) {
			const item = await this.redis.lpop(this.buildListKey(key))
			if (item) items.push(JSON.parse(item))
		}

		return {
			storedCount: await this.getStoredCount(),
			items
		}
	}

	async getStoredCount(): Promise<StoredCount> {
		const storedCount: StoredCount = {}

		const keys = await this.redis.keys(this.keyHead + "*")

		for (const key of keys ) {
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
}