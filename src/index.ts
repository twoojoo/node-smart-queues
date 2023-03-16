export type StorageShiftOutput<T> = {
	storedCount: { [key: string]: number }
	items: QueueItem<T>[]
}

export abstract class Storage<T> {
	abstract push(key: Key, item: QueueItem<T>): void | Promise<void>
	abstract shift(key: Key, count: number): Promise<StorageShiftOutput<T>> | StorageShiftOutput<T>
}

export type QueueItem<T> = {
	pushTimestamp: number
	value: T
}

export type QueueRules<T> = {
	shiftSize?: number
	every?: number
	clonePre?: number,
	clonePreCondition?: CloneCondition<T>,
	clonePost?: number
	clonePostCondition?: CloneCondition<T>,
	exec?: ExecCallback<T>,
}

const DEFAULT_KEY_EXTERNAL = "all"
const DEFAULT_KEY_INTERNAL = "all§nqs§default§key"

export type Key = string | "all"

export type ExecCallback<T> = (item: T) => any

export type CloneCondition<T> = (item: T) => boolean

export class StatefulQueue<T = any> {
	private storage: Storage<T>
	private name: string
	private shiftItemEnabled = false

	private rules: { [key: string]: QueueRules<T> } = {
		[DEFAULT_KEY_INTERNAL]: {}
	}

	constructor(name: string, storage: Storage<T>) {
		this.name = name
		this.storage = storage	
		this.start()
	}

	private async start() {

	}

	/***/
	async push(key: Key, item: T) {
		key = this.parseKey(key)

		const queueItem: QueueItem<T> = {
			pushTimestamp: Date.now(),
			value: item
		} 

		if (!!this.rules[key].clonePre) {
			let toBeCloned = true

			if (this.rules[key].clonePreCondition) {
				toBeCloned = this.rules[key].clonePreCondition(item)
			}

			if (toBeCloned) {
				for (let i; i < this.rules[key].clonePre; i++) {
					await this.storage.push(key, queueItem)
				}
			}
		} else await this.storage.push(key, queueItem)
	}

	/***/
	async shift(key: Key = DEFAULT_KEY_EXTERNAL, count: number = 1, force = false): Promise<T | T[]> {
		if (count == 0) return

		key = this.parseKey(key)

		if (!force && !!this.rules[key].exec) 
			throw Error("nqs error: cannot shift manually if an exec callback is provided")
		
		let items = (await this.storage.shift(key, count)).items

		if (count == 1) return items[0].value
		else return items.map(i => i.value)
	}

	exec(key: Key, callback: ExecCallback<T>) {
		key = this.parseKey(key)
		this.rules[key].exec = callback
		return this
	}

	shiftSize(key: Key, count: number) {
		key = this.parseKey(key)
		this.rules[key].every = count
		return this
	}

	every(key: Key, delay: number) {
		key = this.parseKey(key)
		this.rules[key].every = delay
		return this
	}

	clonePre(key: Key, count: number, condition?: CloneCondition<T>) {
		key = this.parseKey(key)
		this.rules[key].clonePre = count
		this.rules[key].clonePreCondition = condition
		return this
	}

	clonePost(key: Key, count: number, condition?: CloneCondition<T>) {
		key = this.parseKey(key)
		this.rules[key].clonePost = count
		this.rules[key].clonePostCondition = condition
		return this
	}

	private parseKey(key: Key) {		
		if (key == DEFAULT_KEY_EXTERNAL) return DEFAULT_KEY_INTERNAL
		return key
	}
}