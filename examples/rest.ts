import { QueuesPool, Queue, redisStorage } from "../src"
import { setupInterface } from "../interface/server";
import { Redis } from "ioredis";

(async function () {
	await setupInterface(QueuesPool, { port: 3000, logger: true })

	const redis = new Redis({ host: "localhost", port: 6379 })

	const q = new Queue<number>("q1", { 
		onDequeue: async (i) => console.log(i),
		storage: redisStorage(redis),
		dequeueInterval: 2000,
		onDequeueAwait: false,
		gzip: true,
	}).start()

	let count = 0
	while (true) {
		await new Promise(r => setTimeout(() => r(0), 1000))
		await q.enqueue(`k1`, count)
		count++
	}
})()
