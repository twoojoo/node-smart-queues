const queuePool: string[] = []

/**Collects all queue names. 
* Checks if queue names are unique before registering a new name. */
export function registerNewQueue(name: string) {
	if (queuePool.includes(name)) {
		throw Error(`cannot create 2 queues with the same name: '${name}'`)
	} 

	queuePool.push(name)
}

