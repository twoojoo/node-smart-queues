import { QueueItem, QueueMode, StorageShiftOutput, StoredCount } from "../types"
import { Storage } from "./Storage"

export class MemoryStorage extends Storage {
	private memory: { [key: string]: QueueItem[] } = {}

	constructor(name: string) {
		super(name)
	}

	async push(key: string, item: QueueItem): Promise<void> {
		if (!this.memory[key]) this.memory[key] = []
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
				items.push(kind == "FIFO" ? this.memory[key].pop() :this.memory[key].shift())

		return items
	}

	async getStoredCount(): Promise<StoredCount> {
		const storedCount: StoredCount = {}

		for (const key in this.memory) {
			storedCount[key] = this.memory[key]?.length || 0
		}

		return storedCount
	}
}