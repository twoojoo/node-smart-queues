import { registerNewStorage } from "../pool"
import { QueueItem, QueueKind, StorageShiftOutput, StoredCount } from "../types"
import { Storage } from "./Storage"

export class MemoryStorage<T = any> extends Storage {
	private memory: { [key: string]: QueueItem[] } = {}

	constructor(name: string) {
		super(name)
		registerNewStorage(this)
	}

	async push(key: string, item: QueueItem): Promise<void> {
		if (!this.memory[key]) this.memory[key] = []
		this.memory[key].unshift(item)
	}

	async shiftFIFO(key: string, count: number): Promise<StorageShiftOutput> {
		return this.shift("FIFO", key, count)
	}

	async shiftLIFO(key: string, count: number): Promise<StorageShiftOutput> {
		return this.shift("LIFO", key, count)
	}

	async shift(kind: QueueKind, key: string, count: number): Promise<StorageShiftOutput> {
		if (!this.memory[key]) this.memory[key] = []

		const items: QueueItem[] = []

		for (let i = 0; i < count; i++) 
			if (this.memory[key].length > 0) 
				items.push(kind == "FIFO" ? this.memory[key].pop() :this.memory[key].shift())

		return {
			items,
			storedCount: await this.getStoredCount()
		}
	}

	async getStoredCount(): Promise<StoredCount> {
		const storedCount: StoredCount = {}

		for (const key in this.memory) {
			storedCount[key] = this.memory[key]?.length || 0
		}

		return storedCount
	}
}