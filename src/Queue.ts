import { DEFAULT_KEY_EXTERNAL, DEFAULT_KEY_INTERNAL, DEFAULT_SHIFT_RATE } from "./constants"
import { Storage } from "./storage/Storage"
import { CloneCondition, ExecCallback, QueueItem, QueueRules } from "./types"

export class Queue<T = any> {
	private storage: Storage<T>
	private name: string
	private shiftEnabled = false
	private shiftRate: number

	private rules: { [key: string]: QueueRules<T> } = {
		[DEFAULT_KEY_INTERNAL]: {}
	}

	constructor(name: string, storage: Storage<T>, shiftRate: number = DEFAULT_SHIFT_RATE) {
		this.name = name
		this.storage = storage	
		this.shiftRate = shiftRate
		this.startShiftLoop()
	}

	private async startShiftLoop() {
		while (true) {
			if (this.shiftEnabled) {
				for (let key in this.rules) {
					const start = Date.now()
					const keyRules = this.rules[key] || {}

					if (!keyRules.exec) continue

					if (!!keyRules.locked) {
						if ((Date.now() - keyRules.lastLockTimestamp) >= keyRules.every) {
							this.unlockKey(key)
						} else continue
					}

					const shiftSize = keyRules.shiftSize || 1
					const output = await this.storage.shift(key, shiftSize)
					
					this.shiftEnabled = false
					for (let count of Object.values(output.storedCount)) 
						if (count != 0) 
							this.shiftEnabled = true

					if (output.items.length != 0) {
						for (let item of output.items) 
							await keyRules.exec(item.value)

						if (keyRules.every) this.lockKey(key)

						const end = Date.now()
						const duration = end - start
						if (duration < this.shiftRate)
							await new Promise(r => setTimeout(() => r(0), this.shiftRate - duration))
					}
				}
			} else await new Promise(r => setTimeout(() => r(0), this.shiftRate || DEFAULT_SHIFT_RATE))
		}
	}

	private lockKey(key: string) {
		this.rules[key].locked = true
		this.rules[key].lastLockTimestamp = Date.now()
		// const delay = this.rules[key].every
		// console.log(new Date(), "#> locked", key, "for", delay, "ms")
	}

	private unlockKey(key: string) {
		this.rules[key].locked = false
		this.rules[key].lastLockTimestamp = undefined
		// console.log(new Date(), "#> unlocked", key)
	}

	/***/
	async push(key: string, item: T) {
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
				for (let i = 0; i < this.rules[key].clonePre; i++) {
					await this.storage.push(key, queueItem)
				}
			} else await this.storage.push(key, queueItem)
		} else await this.storage.push(key, queueItem)

		this.shiftEnabled = true
	}

	/***/
	async shift(key: string = DEFAULT_KEY_EXTERNAL, count: number = 1): Promise<T | T[]> {
		if (count == 0) return

		key = this.parseKey(key)

		let items = (await this.storage.shift(key, count)).items

		if (count == 1) return items[0].value
		else return items.map(i => i.value)
	}

	exec(key: string, callback: ExecCallback<T>) {
		key = this.parseKey(key)
		this.rules[key].exec = callback
		return this
	}

	shiftSize(key: string, count: number) {
		key = this.parseKey(key)
		this.rules[key].shiftSize = count
		return this
	}

	every(key: string, delay: number) {
		key = this.parseKey(key)
		this.rules[key].every = delay
		return this
	}

	clonePre(key: string, count: number, condition?: CloneCondition<T>) {
		key = this.parseKey(key)
		this.rules[key].clonePre = count
		this.rules[key].clonePreCondition = condition
		return this
	}

	clonePost(key: string, count: number, condition?: CloneCondition<T>) {
		key = this.parseKey(key)
		this.rules[key].clonePost = count
		this.rules[key].clonePostCondition = condition
		return this
	}

	private parseKey(key: string) {		
		if (key == DEFAULT_KEY_INTERNAL) return DEFAULT_KEY_INTERNAL
		if (!this.rules[key]) this.rules[key] = {}
		return key
	}
}