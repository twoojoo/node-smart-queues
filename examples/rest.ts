import { nsqHttpInterface } from "../rest";
import { QueuesPool, SmartQueue } from "../src"

(async function () {
	await nsqHttpInterface(QueuesPool, {port: 3000, logger: true})

	const q = SmartQueue<number>("q1")
		.logger(true)
		.ignoreKeys(["kx"])
		.onFlushAsync("*", (i) => console.log(new Date(), `#>`, i))
		.gzip()
		.start();

	let count = 0
	while(true) {
		await new Promise(r => setTimeout(() => r(0), 1000))
		await q.push(`k1`, count)
		count++
	}
})()
