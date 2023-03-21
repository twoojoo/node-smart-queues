import { Queue, redisStorage } from "../src"
import { Redis } from "ioredis"
const lorem = "Lorem ipsum dolor sit amet, consectetur adipisci elit, sed do eiusmod tempor incidunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrum exercitationem ullamco laboriosam, nisi ut aliquid ex ea commodi consequatur. Duis aute irure reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint obcaecat cupiditat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

(async function () {
	const redis = new Redis({
		host: "localhost",
		port: 6379
	})

	const q = new Queue<string>("q1", {
		storage: redisStorage(redis),
		gzip: true
	}).logger(true)
		.setDelay("*", 1000)
		.onFlushAsync("*", (i) => console.log(new Date(), `#>`, i))
		.gzip()
		.start();

	await q.push("k1", lorem)
	await q.push("k1", lorem)
	await q.push("k1", lorem)
	await q.push("k1", lorem)
	await q.push("k1", lorem)
	await q.push("k2", lorem)
	await q.push("k2", lorem)
})()
