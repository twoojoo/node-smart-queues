import { Queue } from "./Queue"
import { Storage } from "./storage/Storage"

export enum EnqueueResultCode {
	Enqueued = 0,
	KeyIgnored = 1,
	KeyNotPrioritized = 2,
	MissingCondition = 3,
	ErrorOccurred = 3,
}

export type QueueOptions<T> = QueueBasicOptions & KeyOptions<T> & {
	priority?: string[],
	ignore?: string[],
	ignoreNotPrioritized?: boolean,
	randomPriority?: boolean
}

export type GlobalOptions<T> = GlobalRules<T> 
export type GlobalRules<T> = KeyOptions<T> & {
	priority?: string[],
	ignore?: string[],
	ignoreNotPrioritized?: boolean,
	randomPriority?: boolean
}

type QueueBasicOptions = {
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

export type KeyRules<T> = {
	mode?: QueueMode
	lastLockTimestamp?: number,
	locked?: boolean
	ignoreItemCondition?: IgnoreItemCondition<T>
	maxRetry?: number
	onMaxRetry?: OnMaxRetryCallback<T>
	onMaxRetryAwaited?: boolean
	onDequeue?: OnPop<T>
	onDequeueAwaited?: boolean
	dequeueInterval?: number
	dequeueSize?: number
}

export type KeyOptions<T> = Omit<KeyRules<T>, 'lastLockTimestamp' | 'locked'>

export type PriorityOptions = {
	ignoreNotPrioritized?: boolean
}

export type EnqueueOptions = {
	throwErrors?: boolean
}

export type EnqueueResult = {
	enqueued: boolean
	code: EnqueueResultCode,
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
