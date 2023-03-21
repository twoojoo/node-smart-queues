import { Redis } from "ioredis";
import { setupInterface } from "../interface/server";
import { QueuesPool, Queue, fileSystemStorage, redisStorage } from "../src"

(async function () {
	await setupInterface(QueuesPool, { port: 3000, logger: true })

	const redis = new Redis({ host: "localhost", port: 6379 })

	const q = new Queue<number>("q1", {
		storage: redisStorage(redis),
		gzip: true
	}).setDelay("*", 10000)
		.onPop("*", async (i) => {
			console.log("waiting 3 sec")
			await new Promise((r) => setTimeout(() => r(0), 3000))
			console.log("WAITED 3 sec")
		}, { awaited: true })
		.start();

	let count = 0
	while (true) {
		await new Promise(r => setTimeout(() => r(0), 1000))
		await q.push(`k1`, count)
		count++
	}
})()
