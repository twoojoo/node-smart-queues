import { EnqueueResult, EnqueueResultCode, QueuePool } from "../src/types";
import { RouteOptions } from "fastify"
import { getQueue, getQueuesList } from "../src/pool";

export function getRoutes(pool: QueuePool): RouteOptions[] {
	return [{
		method: "GET",
		url: "/v1/ping",
		handler: async (_, rep) => rep.send("pong")
	}, {
		method: "GET",
		url: "/v1/queue",
		handler: async (_, rep) => {
			const queueList = getQueuesList(pool)
			rep.send(queueList.join(","))
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/exists",
		handler: async (req: any, rep) => {
			console.log(req.params.name)
			const exists = !!getQueue(pool, req.params.name)
			rep.send(exists)
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/paused",
		handler: async (req: any, rep) => {
			const paused = getQueue(pool, req.params.name)?.isPaused()
			rep.send(paused)
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/pause",
		handler: async (req: any, rep) => {
			const time = parseInt((req.query as any).time)
			if (time && isNaN(time)) throw Error("time mus be a valid number")
			const queue = getQueue(pool, req.params.name)
			if (time) queue?.pause(time)
			else queue?.pause()
			rep.send()
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/start",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			queue?.start()
			rep.send()
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/key/:key/ignored",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			rep.send(queue.isKeyIgnored(req.params.key))
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/ignore/:keys",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			queue.ignoreKeys(...req.params.keys.split(","))
			rep.send()
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/restore/:keys",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			queue.restoreKeys(...req.params.keys.split(","))
			rep.send()
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/state",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			const storedCount = await queue?.getStorageCount()
			rep.send(
				Object.entries(storedCount)
					.map(([key, count]) => `${key}: ${count}`)
					.join(",")
			)
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/key/:key/state",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			const storedCount = await queue?.getStorageCount()
			rep.send(storedCount[req.params.key])
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/mode",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			rep.send(queue?.getDequeueMode())
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/key/:key/mode",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			rep.send(queue?.getDequeueMode(req.params.key))
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/key/:key/enqueue",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			const itemKind = req.query.kind?.toLowerCase()

			const item = itemKind == "json" ? 
				JSON.parse(req.query.item) :
				itemKind == "number" ?
					parseFloat(req.query.item) :
					req.query.item

			let result: EnqueueResult
			if (!queue) result = {
				enqueued: false,
				message: `queue ${req.params.name} not found`,
				code: EnqueueResultCode.QueueNotFound,
			}
			else result = await queue.enqueue(req.params.key, item)

			rep.send(result)
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/interval",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			if (!req.query.time) rep.status(400).send("time required")
			const dequeueInterval = parseInt(req.query.time)
			if (isNaN(dequeueInterval)) rep.status(400).send("time must be a valid number")
			console.log(dequeueInterval)
			queue.options({ dequeueInterval })
			rep.send()
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/key/:key/interval",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			const key = req.params.key
			if (!key) rep.status(400).send("key required")
			if (!req.query.time) rep.status(400).send("time required")
			const dequeueInterval = parseInt(req.query.time)
			if (isNaN(dequeueInterval)) rep.status(400).send("time must be a valid number")
			queue.options({ dequeueInterval })
			rep.send()
		}
	}]
}
