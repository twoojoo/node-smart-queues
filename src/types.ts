export type QueueKind = "LIFO" | "FIFO"

export type QueueItem<T> = {
	pushTimestamp: number
	value: T
}

export type Rules<T> = {
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
	onPush?: OnPushCallback<T>
	onPushAsync?: OnPushCallback<T>
	locked?: boolean
	ignoreItemCondition?: IgnoreItemCondition<T>
	maxRetry?: number
	onMaxRetry?: OnMaxRetryCallback<T>
	onMaxRetryAsync?: OnMaxRetryCallback<T>
}


export type PriorityOptions = {
	ignoreNotPrioritized?: boolean
}

export type Key = string 

export type OnMaxRetryCallback<T = any> = (item?: T, err?: Error) => any
export type ExecCallback<T = any> = (item: T, key?: string, queue?: string) => any
export type CloneCondition<T = any> = (item: T) => boolean
export type IgnoreItemCondition<T = any> = (item: T) => boolean

export type StoredCount = { [key: string]: number }

export type StorageShiftOutput<T> = {
	storedCount: StoredCount
	items: QueueItem<T>[]
}

export type OnPushCallback<T = any> = (item: T, key?: string, queue?: string) => any