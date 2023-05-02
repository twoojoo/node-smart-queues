import { QueueItem, QueueMode, StoredCount, TTLOptions } from "../types"
import { Storage } from "./Storage"

export class MemoryStorage extends Storage {
	private memory: { [key: string]: QueueItem[] } = {}

	private timestampsCache: number[] = []

	constructor(name: string, opts: TTLOptions) {
		super(name, opts.TTLms)
		this.runTTLCleanup()
	}

	async push(key: string, item: QueueItem): Promise<void> {
		if (!this.memory[key]) this.memory[key] = []
		if (this.TTLms) {
			this.timestampsCache.push(item.pushTimestamp)
			this.runTTLCleanup({ forceThreshold: true })
		}
		this.memory[key].unshift(item)
	}

	async popRight(key: string, count: number): Promise<QueueItem[]> {
		return this.pop("FIFO", key, count)
	}

	async popLeft(key: string, count: number): Promise<QueueItem[]> {
		return this.pop("LIFO", key, count)
	}

	async pop(kind: QueueMode, key: string, count: number): Promise<QueueItem[]> {
		if (!this.memory[key]) this.memory[key] = []

		const items: QueueItem[] = []

		for (let i = 0; i < count; i++) 
			if (this.memory[key].length > 0) 
				items.push(kind == "FIFO" ? this.memory[key].pop() : this.memory[key].shift())

		return items
	}

	async getStoredCount(): Promise<StoredCount> {
		const storedCount: StoredCount = {}

		for (const key in this.memory) {
			storedCount[key] = this.memory[key]?.length || 0
		}

		return storedCount
	}

	protected async getFirstTimestamp(): Promise<number> {
		return this.timestampsCache.shift()
	}

	protected async cleanupKeys(threshold: number): Promise<number> {
		if (!this.TTLms) return

		let count = 0

		for (const key in this.memory) {
			this.memory[key] = this.memory[key].filter(item => {
				if (item.pushTimestamp > threshold) return true
				else {
					count++
					return false
				}
			})
		}

		return count
	}
}