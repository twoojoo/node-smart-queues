
export type QueueItem<T> = {
	pushTimestamp: number
	value: T
}

export type QueueRules<T> = {
	shiftSize?: number
	every?: number,
	lastLockTimestamp?: number,
	clonePre?: number,
	clonePreCondition?: CloneCondition<T>,
	clonePost?: number
	clonePostCondition?: CloneCondition<T>,
	exec?: ExecCallback<T>,
	locked?: boolean
}

export type Key = string 

export type ExecCallback<T> = (item: T) => any

export type CloneCondition<T> = (item: T) => boolean

export type StoredCount = { [key: string]: number }

export type StorageShiftOutput<T> = {
	storedCount: StoredCount
	items: QueueItem<T>[]
}
