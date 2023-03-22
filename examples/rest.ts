import { Redis } from "ioredis";
import { setupInterface } from "../interface/server";
import { QueuesPool, Queue, fileSystemStorage, redisStorage } from "../src"

(async function () {
	await setupInterface(QueuesPool, { port: 3000, logger: true })

	const redis = new Redis({ host: "localhost", port: 6379 })

	const q = new Queue<number>("q1", { storage: redisStorage(redis), gzip: true })
		.setLIFO()
		.delay("*", 2000)
		.onPop("*", async (i) => {
			console.log(i)
			await new Promise((r) => setTimeout(() => r(0), 3000))
			console.log("WAITED 3 sec", i)
		}, { awaited: false })
		.start();

	let count = 0
	while (true) {
		await new Promise(r => setTimeout(() => r(0), 1000))
		await q.push(`k1`, count)
		count++
	}
})()
