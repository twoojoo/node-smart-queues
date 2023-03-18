import { StorageShiftOutput } from "../types";
import { QueueItem } from "../types";

export abstract class Storage {
	protected name: string

	constructor(name: string) {
		this.name = name
	}

	getName() {
		return this.name
	}

	abstract push(key: string, item: QueueItem): Promise<void>
	abstract shiftFIFO(key: string, count: number): Promise<StorageShiftOutput>
	abstract shiftLIFO(key: string, count: number): Promise<StorageShiftOutput>
}