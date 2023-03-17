import { QueuePool, SmartQueue } from "../src"

(async function () {

	//declare the queue
	const queue1 = SmartQueue<number>("q1", { logger: true })
		.inMemoryStorage() // set memory as storage (redundant, memory is default)
		.setLIFO("*") // set LIFO behaviour for all keys
		.randomizePriority() // overrides priority settings and randomize keys priority
		.setPriority(["k1", "k2"], { ignoreNotPrioritized: false }) // overrides randomize (id set) set the keys priority
		.clonePre("*", 2, (i) => i == 3) // clone items (2 copies) before pushing them to the storage (for all keys) on a certain condition
		.clonePost("*", 1) // clone items (1 copy - useless) before flushing them from the queue (for all keys)
		.flushEvery("*", 1000) // set a distance of 1000ms between each flush for all keys
		.flushEvery("k1", 3000) // set a distance of 3000ms between each flush for key "k1" only (overrides the global "flushEvert" setting)
		.flushSize("*", 2) // flush 2 items at one time for every key
		.ignoreKeys("k1") // ignore items pushed for key k1
		.onFlush("*", async (i, k, q) => console.log(new Date(), `#> flushed value:`, i)) // executed for every item flushed (awaited if async)
		.onFlushAsync("*", async (i, k, q) => console.log(new Date(), `#> flushed value:`, i)) // executed for every item flushed (not awaited, overrides previous onFlush callbacks)
		.onFlushAsync("k2", async (i, k, q) => console.log(new Date(), `#> flushed value (${k}):`, i)) // executed only for k2 items (overrides global onPush for k2 items)

	//print names of the queues in the queue pool
	console.log(new Date(), `#> queue list:`, QueuePool.getQueuesList()) 

	//tells if a queue exists
	console.log(new Date(), `#> queue q1 exists:`, QueuePool.queueExists("q1")) //true
	console.log(new Date(), `#> queue q2 exists:`, QueuePool.queueExists("q2")) //false

	queue1
		.start() // starts the queue shifiting (push is always active)
		.pause(5000) //pause the shifting for 1000ms (calls start() after the timer has expired)
	//providing no timer will cause the quee to pause indefinitely (until the a start() is manually triggered)

	console.log(new Date(), `#> is q1 paused (1):`, queue1.isPaused()) //true
	console.log(new Date(), `#> is q1 paused (2):`, QueuePool.isQueuePaused("q1")) //same as previous

	//these items will be skipped because key k1 is ignored here
	await queue1.push("k1", 1)
	await queue1.push("k1", 2)

	console.log(new Date(), `#> is k1 ignored (1):`, queue1.isKeyIgnored("k1")) //true
	console.log(new Date(), `#> is k1 ignored (2):`, QueuePool.isQueueKeyIgnored("q1", "k1")) //same as previous

	console.log(new Date(), `#> is q1 looping (1):`, queue1.isLooping()) //false (cause it's still paused)
	console.log(new Date(), `#> is q1 looping (2):`, QueuePool.isQueueLooping("q1")) //same as previous

	//restoring k1 will enable k1 item pushing
	queue1.restoreKeys(["k1"])

	queue1.ignoreKeys(["k1", "k2"]) //disabling both k1 and k2
	queue1.restoreKeys("*") //restoring all keys

	await queue1.push("k1", 3)
	await queue1.push("k1", 4)
	await queue1.push("k1", 5)

	await queue1.push("k2", 5)
	await queue1.push("k2", 6)

	// k3 items will be ignored because k3 is not prioritized
	// and the queue is set to ignore not prioritized keys
	await queue1.push("k3", 8)

})()
