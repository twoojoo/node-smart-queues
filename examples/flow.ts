import { Queue, redisStorage } from "../src"
import { Redis } from "ioredis";

(async function () {
	const redis = new Redis({ host: "localhost", port: 6379 })

	const q = new Queue<number>("q1", { storage: redisStorage(redis) })

	q.start() 
	q.pause() //pause untill a new start() is called
	q.pause(3000) //pause untill the time (ms) has expired

	let count = 0
	while (true) {
		await new Promise(r => setTimeout(() => r(0), 1000))
		await q.enqueue(`k1`, count)
		count++
	}
})()
