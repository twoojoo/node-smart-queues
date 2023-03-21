import { Queue } from "./Queue"
import { QueuePool } from "./types"

export const QueuesPool: QueuePool = []

/**Collects all queues. 
* Checks if queue names are unique before registering a new name (throw an error if the name already exists). */
export function registerNewQueue(queue: Queue) {
	if (QueuesPool.map(q => q.getName()).includes(queue.getName())) {
		throw Error(`cannot create 2 queues with the same name: '${name}'`)
	} 
	QueuesPool.push(queue)
}

/**Retrieve the list of queue names from the queues pool.*/
export function getQueue(pool: QueuePool, name: string): Queue {
	return pool.find(q => q.getName() == name)
}

/**Retrieve the list of quque names from the queues pool.*/
export function getQueuesList(pool: QueuePool): string[] {
	return pool.map(q => q.getName())
}