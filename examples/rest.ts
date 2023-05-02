import { QueuesPool, Queue, redisStorage, inMemoryStorage } from "../src"
import { nsqServer } from "../http";

(async function () {
	await nsqServer(QueuesPool, { port: 3000, logger: true })

	const q = new Queue<number>("q1", { 
		onDequeue: async (i) => console.log(i),
		storage: inMemoryStorage(800),
		// storage: redisStorage({ host: "localhost", port: 6379 }, 800),
		dequeueInterval: 2500,
		onDequeueAwaited: true,
		gzip: true,
		mode: "FIFO"
	}).start()

	let count = 0
	while (true) {
		await new Promise(r => setTimeout(() => r(0), 1000))
		const { message, enqueued } = await q.enqueue(`k1`, count)
		if (!enqueued) console.log(message)
		count++
	}
})()
