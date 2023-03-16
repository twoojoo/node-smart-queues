import { Queue, MemoryStorage } from "../src"

const q = new Queue<number>("my-queue", new MemoryStorage(), 1000)
	// .clonePre("*", 2, i => i > 3)
	// .clonePre("custom-key", 2, i => i == 6)
	// .shiftSize("*", 2)
	.every("*", 3000)
	.exec("*", (item) => console.log(item))
	.exec("custom-key", (item) => console.log(item));

(async function () {
	await q.push("*", 1)
	await q.push("*", 2)
	await q.push("*", 3)
	await q.push("*", 4)
	await q.push("*", 5)
	await q.push("custom-key", 5)
	await q.push("custom-key", 6)
})()
