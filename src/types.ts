export type QueueKind = "LIFO" | "FIFO"

export type QueueItem<T> = {
	pushTimestamp: number
	value: T
}

export type Properties<T> = {
	kind?: QueueKind //default fifo
	shiftSize?: number
	every?: number,
	lastLockTimestamp?: number,
	clonePre?: number,
	clonePreCondition?: CloneCondition<T>,
	clonePost?: number
	clonePostCondition?: CloneCondition<T>,
	exec?: ExecCallback<T>,
	execAsync?: ExecCallback<T>,
	locked?: boolean
}

export type Key = string 

export type ExecCallback<T = any> = (item: T, key?: string, queue?: string) => any

export type CloneCondition<T = any> = (item: T) => boolean

export type StoredCount = { [key: string]: number }

export type StorageShiftOutput<T> = {
	storedCount: StoredCount
	items: QueueItem<T>[]
}