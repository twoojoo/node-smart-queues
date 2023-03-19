import { Queue } from "./Queue"

export type QueueKind = "LIFO" | "FIFO"

export type QueueItem = {
	pushTimestamp: number
	value: Buffer
}

export type QueueItemParsed<T> = {
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

export type PushOptions = {
	throwErrors?: boolean
}

export type PushResult= {
	pushed: boolean
	message?: string
	error?: Error
}


type GenericQueueCallback<T = any> = (item: T, key?: string, queue?: Queue) => any
export type ExecCallback<T = any> = GenericQueueCallback<T>
export type OnPushCallback<T = any> = GenericQueueCallback<T>
export type OnMaxRetryCallback<T = any> = (err?: Error, item?: T, key?: string, queue?: Queue) => any

type Condition<T = any> = (item: T) => boolean
export type CloneCondition<T = any> = Condition<T>
export type IgnoreItemCondition<T = any> = Condition<T>

export type StoredCount = { [key: string]: number }

export type StorageShiftOutput = {
	storedCount: StoredCount
	items: QueueItem[]
}
