import { QueuePool } from "../src/types";
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
			queue.ignoreKeys(req.params.keys.split(","))
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
			rep.send(queue?.getFlushMode())
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/key/:key/mode",
		handler: async (req: any, rep) => {
			const queue = getQueue(pool, req.params.name)
			rep.send(queue?.getFlushMode(req.params.key))
		}
	}]
}
