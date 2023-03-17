import { SmartQueue } from "../src"

const q = SmartQueue<number>("my-queue")
	.lifo("*")
	.every("*", 1000)
	.priority(["key1"], true)
	.clonePost("*", 4)
	.every("key1", 3000)
	.execAsync("*", async (item, key) => console.log(item, key, Date.now()))
	.execAsync("key1", (item, key) => console.log(item, key, Date.now()));

(async function () {
	await q.push("key1", 1)
	await q.push("key1", 2)
	await q.push("key1", 3)
	await q.push("key1", 4)
	await q.push("key1", 5)
	await q.push("key2", 5)
	await q.push("key2", 6)
})()
