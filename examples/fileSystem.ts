import { SmartQueue } from "../src"

const q = SmartQueue<number>("my-queue")
	.fileSystemStorage("./file.txt")
	.fifo("key1")
	.lifo("key2")
	.every("*", 1000)
	.execAsync("*", async (item, key) => console.log(item, key, Date.now()));

(async function () {
	await q.push("key1", 1)
	await q.push("key1", 2)
	await q.push("key1", 3)
	await q.push("key1", 4)
	await q.push("key1", 5)
	await q.push("key2", 5)
	await q.push("key2", 6)
})()

const q1 = SmartQueue<number>("my-queue1")
	.fileSystemStorage("./file.txt")
	.fifo("key1")
	.lifo("key2")
	.every("*", 1000)
	.execAsync("*", async (item, key) => console.log(item, key, Date.now()));

(async function () {
	await q1.push("key1", 1)
	await q1.push("key1", 2)
	await q1.push("key1", 3)
	await q1.push("key1", 4)
	await q1.push("key1", 5)
	await q1.push("key2", 5)
	await q1.push("key2", 6)
})()
