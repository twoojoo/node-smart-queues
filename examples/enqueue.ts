import { Queue } from "../src"

(async function () {
	const q = new Queue<number>("q1", {
		onDequeue: (i) => console.log(new Date(), `#>`, i),
		dequeueInterval: 1000,
		ignore: ["k2"]
	}).start();

	for (let i = 1; i < 4; i++) {
		const {
			enqueued,
			message,
			error
		} = await q.enqueue(`k${i}`, i, { throwErrors: false })

		console.log(new Date(), `#> k${i} item pushed?`, enqueued, message || "")
		if (error) console.error(error)
	}
})()
