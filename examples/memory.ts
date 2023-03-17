import { getQueuesList, SmartQueue } from "../src"

(async function () {
	const q = SmartQueue<number>("q1")
		.lifo("*")
		.every("*", 1000)
		.priority(["k1"], true)
		.clonePost("*", 4)
		.every("k1", 3000)
		.inMemoryStorage()
		.execAsync("*", async (i, k, q) => console.log(q, k, i, `${Date.now()}`))

	await q.push("k1", 1)
	await q.push("k1", 2)
	await q.push("k1", 3)
	await q.push("k1", 4)
	await q.push("k1", 5)
	await q.push("k2", 5)
	await q.push("k2", 6)
})()

console.log(getQueuesList())