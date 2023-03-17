const queuePool: string[] = []

export function registerNewQueue(name: string) {
	if (queuePool.includes(name)) {
		throw Error(`cannot create 2 queues with the same name: '${name}'`)
	} 

	queuePool.push(name)
}

