import { Queue } from "./Queue"
import { Storage } from "./storage/Storage"

export type QueueStaticOptions = {
	storage?: StorageBuilder
	loopRate?: number
	gzip?: boolean
	logger?: boolean
}

export type StorageBuilder = (name: string) => Storage

export type QueuePool = Queue<any>[]

export type QueueMode = "LIFO" | "FIFO"

export type QueueItem = {
	pushTimestamp: number
	value: Buffer
}

export type QueueItemParsed<T> = {
	pushTimestamp: number
	value: T
}

export type Rules<T> = {
	mode?: QueueMode
	lastLockTimestamp?: number,
	onPush?: OnPushCallback<T>
	onPushAwait?: boolean
	locked?: boolean
	ignoreItemCondition?: IgnoreItemCondition<T>
	maxRetry?: number
	onMaxRetry?: OnMaxRetryCallback<T>
	onMaxRetryAwait?: boolean
	onPop?: OnPop<T>
	onPopAwait?: boolean
	delay?: number
	popSize?: number
}


export type PriorityOptions = {
	ignoreNotPrioritized?: boolean
}

export type PushOptions = {
	throwErrors?: boolean
}

export type PushResult = {
	pushed: boolean
	message?: string
	error?: Error
}

export type CallbackOptions = { awaited?: boolean }
type GenericQueueCallback<T = any> = (item: T, key?: string, queue?: Queue) => any
export type ExecCallback<T = any> = GenericQueueCallback<T>
export type OnPop<T = any> = GenericQueueCallback<T>
export type OnPushCallback<T = any> = GenericQueueCallback<T>
export type OnMaxRetryCallback<T = any> = (err?: Error, item?: T, key?: string, queue?: Queue) => any

type Condition<T = any> = (item: T) => boolean
// export type CloneCondition<T = any> = Condition<T>
export type IgnoreItemCondition<T = any> = Condition<T>

export type StoredCount = { [key: string]: number }

export type StorageShiftOutput = {
	storedCount: StoredCount
	items: QueueItem[]
}
