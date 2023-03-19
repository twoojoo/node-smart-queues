import { Storage } from "./storage/Storage"
import { Queue } from "./Queue"
import { QueuePool } from "./types"

const queues: Queue<any>[] = []
const storages: Storage[] = []

/**Collects all queues. 
* Checks if queue names are unique before registering a new name (throw an error if the name already exists). */
export function registerNewQueue(queue: Queue) {
	if (queues.map(q => q.getName()).includes(queue.getName())) {
		throw Error(`cannot create 2 queues with the same name: '${name}'`)
	} 
	queues.push(queue)
}

/**Collects all storages*/
export function registerNewStorage<T>(storage: Storage) {
	storages.push(storage)
}

export const QueuesPool: QueuePool = {
	queues,
	getQueuesList,
	queueExists,
	getQueue,
	isQueueLooping,
	isQueuePaused,
	isQueueKeyIgnored
}

/**Retrieve the list of quque names from the queues pool.*/
function getQueue(name: string): Queue {
	return queues.find(q => q.getName())
}

/**Retrieve the list of quque names from the queues pool.*/
function getQueuesList(): string[] {
	return queues.map(q => q.getName())
}

/**Tells if a specific queue exists in the queues pool.*/
function queueExists(name: string): boolean {
	return !!queues.find(q => q.getName() == name)
}

/**Tells if a specific queue is paused*/
function isQueuePaused(name: string): boolean {
	return queues.find(q => q.getName() == name)?.isPaused()
}

/**Tells if a specific queue is looping*/
function isQueueLooping(name: string): boolean {
	return queues.find(q => q.getName() == name)?.isLooping()
}

/**Tells if a key is ignored by a specific queue*/
function isQueueKeyIgnored(name: string, key: string): boolean {
	return queues.find(q => q.getName() == name)?.isKeyIgnored(key)
}

// /**Tells if a key is ignored by a specific queue*/
// function listIgnoredKeys(name: string): boolean {
// 	return queues.find(q => q.getName() == name)?.isKeyIgnored(key)
// }