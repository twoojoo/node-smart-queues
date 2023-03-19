import { SmartQueue } from "../src"

(async function () {
	const q = SmartQueue<number>("q1")
		.logger(true)
		.setDelay("*", 1000)
		.ignoreKeys("k2")
		.onPush("k3", () => { throw Error("some error") })
		.onFlushAsync("*", (i) => console.log(new Date(), `#>`, i))
		.pause(2000);

	for (let i = 1; i < 4; i++) {
		const {
			pushed,
			message,
			error
		} = await q.push(`k${i}`, i, { throwErrors: false })

		console.log(new Date(), `#> k${i} item pushed?`, pushed, message || "")

		if (error) console.error(error)
	}
})()
