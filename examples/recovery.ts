import { SmartQueue } from "../src"
import { Redis } from "ioredis"

(async function () {
	const redis = new Redis({
		host: "localhost",
		port: 6379
	})

	const q = SmartQueue<number>("q1")
		.logger(true)
		.fileSystemStorage("./file.txt")
		.setDelay("*", 1000)
		.onFlushAsync("*", (i) => console.log(new Date(), `#>`, i))
		.gzip()
		.pause(500);

	/**- run the program
	 * - forcely stop it while still flushing items
	 * - comment the following lines
	 * - check if the missing items are recovered from the storage
	 * */

	// await q.push("k1", 1)
	// await q.push("k1", 2)
	// await q.push("k1", 3)
	// await q.push("k1", 4)
	// await q.push("k1", 5)
	// await q.push("k2", 6)
	// await q.push("k2", 7)
})()
