import { getQueuesList, SmartQueue } from "../src"

(async function () {

	//declare the queue
	const queue1 = SmartQueue<number>("q1", { logger: true })
		.inMemoryStorage() // set memory as storage (redundant, memory is default)
		.lifo("*") // set LIFO behaviour for all keys
		.priority(["k1", "k2"], true) // set the key priority + ignore not priotirized keys
		.clonePre("*", 4) // clone items (4 copies) before pushing them to the storage (for all keys)
		.clonePost("*", 1) // clone items (1 copy - useless) before flushing them from the queue (for all keys)
		.every("*", 1000) // set a distance of 1000ms between each flush for all keys
		.every("k1", 3000) // set a distance of 3000ms between each flush for key "k1" only (overrides the global "every" setting)
		.onFlush("*", async (i, k, q) => console.log(new Date(), `#> value:`, i)) // execute for every item flushed

	//print names of the queues in the queue pool
	console.log(new Date(), `#> queue list:`, getQueuesList()) 

	queue1
		.start() // starts the queue shifiting
		.pause(5000) //pause the shifting for 1000ms (calls start() after the timer has expired)

	//push items to the queue
	await queue1.push("k1", 1)
	await queue1.push("k1", 2)
	await queue1.push("k1", 3)
	await queue1.push("k1", 4)
	await queue1.push("k1", 5)
	await queue1.push("k2", 5)
	await queue1.push("k2", 6)
	await queue1.push("k3", 8)

})()
