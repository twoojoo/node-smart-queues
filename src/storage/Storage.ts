import { QueueItem, StoredCount } from "../types";

export abstract class Storage {
	protected TTLtimer: NodeJS.Timer
	public initialized: boolean = false

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

	/**pick the first timestap available and cleanup items that have been pushed
	 * before that timestamp + the TTL value (recursive). Use forceThreshold option to
	 * force a cleanup with the current datetime as threshold, to be run in the storage
	 * constructor.*/
	protected async runTTLCleanup(opts?: { forceThreshold?: boolean }) {
		if (!this.TTLms) {
			this.initialized = true
			return
		}
		
		if (this.TTLtimer) return

		let threshold: number
		let timer: number 
		do {
			threshold = await this.getFirstTimestamp()
			if (!threshold && !opts?.forceThreshold) return
			if (!threshold && opts?.forceThreshold) threshold = Date.now()
			timer = (Date.now() - (threshold + this.TTLms)) * -1
		} while (timer < 0)

		this.TTLtimer = setTimeout(async () => {
			this.TTLtimer = undefined
			const removedCount = await this.cleanupKeys(threshold)
			if (removedCount) console.log(new Date(), "# nsq #", `[${this.name}]`, "cleaned up", removedCount, `item [TTL: ${this.TTLms} ms]`)
			await this.runTTLCleanup()
			if (opts?.forceThreshold) this.initialized = true
		}, opts?.forceThreshold ? 0 : timer)
	}

	/**retrieve the first available push timestamp*/
	protected abstract getFirstTimestamp(): Promise<number> 

	/**removes the elements inserted before the provide thresholt, returnin the number of removed items*/
	protected abstract cleanupKeys(threshold: number): Promise<number>
}