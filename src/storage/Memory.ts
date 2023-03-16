import { QueueItem, StorageShiftOutput, StoredCount } from "../types"
import { Storage } from "./Storage"

export class MemoryStorage<T = any> extends Storage<T> {
	private memory: { [key: string]: QueueItem<T>[] } = {}

	async push(key: string, item: QueueItem<T>): Promise<void> {
		if (!this.memory[key]) this.memory[key] = []
		this.memory[key].unshift(item)
	}

	async shift(key: string, count: number): Promise<StorageShiftOutput<T>> {
		if (!this.memory[key]) this.memory[key] = []

		const items: QueueItem<T>[] = []
		for (let i = 0; i < count; i++) {
			if (this.memory[key].length > 0) 
				items.push(this.memory[key].pop())
		}

		return {
			items,
			storedCount: this.getStoredCount()
		}
	}

	private getStoredCount(): StoredCount {
		const storedCount: StoredCount = {}

		for (const key in this.memory) {
			storedCount[key] = this.memory[key]?.length || 0
		}

		return storedCount
	}
}