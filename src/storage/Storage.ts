import { QueueItem, StoredCount } from "../types";

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
	abstract popRight(key: string, count: number): Promise<QueueItem[]>

	/**Shift the last n items in from the storage that have been pushed*/
	abstract popLeft(key: string, count: number): Promise<QueueItem[]>

	/**Get the number of items in the queeue for all the keys*/
	abstract getStoredCount(): Promise<StoredCount>
}