import { QueuesPool, Queue, redisStorage } from "../src"
import { nsqServer } from "../http";

(async function () {
	await nsqServer(QueuesPool, { port: 3000, logger: true })

	const q = new Queue<number>("q1", { 
		onDequeue: async (i) => console.log(i),
		storage: redisStorage({ host: "localhost", port: 6379 }),
		dequeueInterval: 2000,
		onDequeueAwaited: false,
		gzip: true,
	}).start()

	let count = 0
	while (true) {
		await new Promise(r => setTimeout(() => r(0), 1000))
		await q.enqueue(`k1`, count)
		count++
	}
})()
