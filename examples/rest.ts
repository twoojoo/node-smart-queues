import { Redis } from "ioredis";
import { nsqHttpInterface } from "../rest";
import { QueuesPool, SmartQueue } from "../src"

(async function () {
	await nsqHttpInterface(QueuesPool, { port: 3000, logger: true })

	const redis = new Redis({ host: "localhost", port: 6379 })

	const q = SmartQueue<number>("q1")
		.logger(true)
		.redisStorage(redis)
		.ignoreKeys(["kx"])
		.setDelay("*", 2000)
		.onFlush("*", async (i) => console.log(new Date(), `#>`, i))
		.start();

	let count = 0
	while (true) {
		await new Promise(r => setTimeout(() => r(0), 1000))
		await q.push(`k1`, count)
		count++
	}
})()
