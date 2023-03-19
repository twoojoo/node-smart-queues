import { nsqHttpInterface } from "../rest";
import { QueuesPool, SmartQueue } from "../src"
import { Redis } from "ioredis"

const lorem = "Lorem ipsum dolor sit amet, consectetur adipisci elit, sed do eiusmod tempor incidunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrum exercitationem ullamco laboriosam, nisi ut aliquid ex ea commodi consequatur. Duis aute irure reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint obcaecat cupiditat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";


(async function () {
	await nsqHttpInterface(QueuesPool, {port: 3000, logger: true})

	const redis = new Redis({
		host: "localhost",
		port: 6379
	})

	const q = SmartQueue<number>("q1")
		.logger(true)
		// .redisStorage(redis)
		.setDelay("*", 1000)
		.ignoreKeys(["kx"])
		.onFlushAsync("*", (i) => console.log(new Date(), `#>`, i))
		.gzip()
		.start();

	let count = 0
	while(true) {
		await new Promise(r => setTimeout(() => r(0), 500))
		await q.push(`k1`, count)
		count++
	}
})()
