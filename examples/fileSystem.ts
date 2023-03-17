import { ExecCallback, SmartQueue } from "../src"

const logOutput: ExecCallback<number> = 
	async (i, k, q) => { console.log(q, k, i, `${Date.now()}`) }

const q = SmartQueue<number>("q1")
	.fileSystemStorage("./file.txt")
	.fifo("k1")
	.lifo("k2")
	.every("*", 1000)
	.onFlushAsync("*", logOutput)
	.start();

(async function () {
	await q.push("k1", 1)
	await q.push("k1", 2)
	await q.push("k1", 3)
	await q.push("k1", 4)
	await q.push("k1", 5)
	await q.push("k2", 5)
	await q.push("k2", 6)
})()

const q1 = SmartQueue<number>("q2")
	.fileSystemStorage("./file.txt")
	.lifo("k1")
	.fifo("key2")
	.every("*", 1000)
	.onFlushAsync("*", logOutput)
	.start();;

(async function () {
	await q1.push("k1", 1)
	await q1.push("k1", 2)
	await q1.push("k1", 3)
	await q1.push("k1", 4)
	await q1.push("k1", 5)
	await q1.push("k2", 5)
	await q1.push("k2", 6)
})()
