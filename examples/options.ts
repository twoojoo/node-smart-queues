import { Queue, redisStorage } from "../src"
import { Redis } from "ioredis";

(async function () {
	const redis = new Redis({ host: "localhost", port: 6379 })

	const q = new Queue<number>("q1", { 
		storage: redisStorage(redis),
		logger: true,
		gzip: true,
		dequeueSize: 2,
		onDequeue: async (i, k, q) => console.log("success:", i, k, q),
		onDequeueAwait: false,
		priority: ["k2", "k3", "k4"],
		ignore: ["k5"],
		ignoreNotPrioritized: true,
		randomPriority: false,
		ignoreItemCondition: i => i >= 12,
		dequeueInterval: 2000,
		maxRetry: 5,
		onMaxRetry: async (err, i, k, q) => console.log("error:", err, i, k, q),
		onMaxRetryAwait: true,
		mode: "LIFO",
	})

	q.key("k1", {
		dequeueSize: 2,
		onDequeue: async (i, k, q) => console.log("success k2:", i, k, q),
		onDequeueAwait: false,
		ignoreItemCondition: i => i <= 3,
		dequeueInterval: 5000,
		maxRetry: 1,
		onMaxRetry: async (err, i, k, q) => console.log("error k2:", err, i, k, q),
		onMaxRetryAwait: false,
		mode: "FIFO",
	})

	let count = 0
	while (true) {
		await new Promise(r => setTimeout(() => r(0), 1000))
		await q.enqueue(`k1`, count)
		count++
	}
})()
