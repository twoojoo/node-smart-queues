import { Storage } from "./storage/Storage"
import { Queue } from "./Queue"

const queuePool: Queue<any>[] = []
const storagePool: Storage<any>[] = []

/**Collects all queues. 
* Checks if queue names are unique before registering a new name (throw an error if the name already exists). */
export function registerNewQueue(queue: Queue) {
	if (queuePool.map(q => q.getName()).includes(queue.getName())) {
		throw Error(`cannot create 2 queues with the same name: '${name}'`)
	} 
	queuePool.push(queue)
}

/**Collects all storages*/
export function registerNewStorage<T>(storage: Storage<T>) {
	storagePool.push(storage)
}

/**Retrieve the list of quque names from the queues pool.*/
export function getQueuesList(): string[] {
	return queuePool.map(q => q.getName())
}

/**Tells if a queue exists in the queues pool.*/
export function queueExists(name: string): boolean {
	return !!queuePool.find(q => q.getName() == name)
}
