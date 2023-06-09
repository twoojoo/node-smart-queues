import { Queue, redisStorage } from "../src"

(async function () {
	
	const q1 = new Queue<number>("q1", { 
		storage: redisStorage({ host: "localhost", port: 6379 }), //default memory
		logger: true, //defalut true
		gzip: true, //default false
		dequeueSize: 2, //default 1
		onDequeue: async (i, k, q) => console.log("success:", i, k, q),
		onDequeueAwaited: false, //default true
		priority: ["k2", "k3", "k4"], 
		ignore: ["k5"],
		ignoreNotPrioritized: true, //default false
		randomPriority: false, //default false 
		ignoreItemOn: i => i >= 12,
		minInterval: 2000, //default 0
		maxRetry: 5, //default 1 attempt
		onMaxRetry: async (err, i, k, q) => console.log("error:", err, i, k, q),
		onMaxRetryAwaited: true, //default true
		mode: "LIFO", //default FIFO
	})

	q1.key("k1", {
		dequeueSize: 2,
		onDequeue: async (i, k, q) => console.log("success k2:", i, k, q),
		onDequeueAwaited: false,
		ignoreItemOn: i => i <= 3,
		minInterval: 5000,
		maxRetry: 1,
		onMaxRetry: async (err, i, k, q) => console.log("error k2:", err, i, k, q),
		onMaxRetryAwaited: false,
		mode: "FIFO",
	})

	let count = 0
	while (true) {
		await new Promise(r => setTimeout(() => r(0), 1000))
		await q1.enqueue(`k1`, count)
		count++
	}
})()
