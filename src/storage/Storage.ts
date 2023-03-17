import { StorageShiftOutput } from "../types";
import { QueueItem } from "../types";

export abstract class Storage<T> {
	protected name: string

	constructor(name: string) {
		this.name = name
	}

	abstract push(key: string, item: QueueItem<T>): Promise<void>
	abstract shiftFIFO(key: string, count: number): Promise<StorageShiftOutput<T>>
	abstract shiftLIFO(key: string, count: number): Promise<StorageShiftOutput<T>>
}