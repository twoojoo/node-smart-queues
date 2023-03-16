import { StorageShiftOutput } from "../types";
import { QueueItem } from "../types";

export abstract class Storage<T> {
	abstract push(key: string, item: QueueItem<T>): Promise<void>
	abstract shift(key: string, count: number): Promise<StorageShiftOutput<T>>
}