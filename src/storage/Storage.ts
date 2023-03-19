import { StorageShiftOutput, StoredCount } from "../types";
import { QueueItem } from "../types";

export abstract class Storage {
	protected name: string

	constructor(name: string) {
		this.name = name
	}

	getName() {
		return this.name
	}

	/**Push an item to the storage*/
	abstract push(key: string, item: QueueItem): Promise<void>
	
	/**Shift the first n items in from the storage that have been pushed*/
	abstract shiftFIFO(key: string, count: number): Promise<StorageShiftOutput>

	/**Shift the last n items in from the storage that have been pushed*/
	abstract shiftLIFO(key: string, count: number): Promise<StorageShiftOutput>

	/**Get the number of items in the queeue for all the keys*/
	abstract getStoredCount(): Promise<StoredCount>
}