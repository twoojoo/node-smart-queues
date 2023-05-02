import { QueueItem, StoredCount } from "../types";

export abstract class Storage {
	protected TTLtimer: NodeJS.Timer

	constructor(protected name: string, protected TTLms: number) {}

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

	protected async runTTLCleanup() {
		if (!this.TTLms) return
		if (this.TTLtimer) return

		let threshold: number
		let timer: number 
		do {
			threshold = await this.getFirstTimestamp()
			if (!threshold) return
			timer = (Date.now() - (threshold + this.TTLms)) * -1
		} while (timer < 0)

		this.TTLtimer = setTimeout(async () => {
			this.TTLtimer = undefined
			const removedCount = await this.cleanupKeys(threshold)
			if (removedCount) console.log(new Date(), "# nsq #", `[${this.name}]`, "cleaned up", removedCount, `item [TTL: ${this.TTLms} ms]`)
			this.runTTLCleanup()
		}, timer)
	}

	protected abstract getFirstTimestamp(): Promise<number> 

	/**removes the elements inserted before the provide thresholt, returnin the number of removed items*/
	protected abstract cleanupKeys(threshold: number): Promise<number>
}