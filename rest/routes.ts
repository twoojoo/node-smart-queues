import { QueuePool } from "../src/types";
import { RouteOptions } from "fastify"

export function getRoutes(pool: QueuePool): RouteOptions[] {
	return [{
		method: "GET",
		url: "/v1/queue",
		handler: (_, rep) => {
			const queueList = pool.getQueuesList()
			rep.send(queueList.join(", "))
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/exists",
		handler: (req, rep) => {
			const exists = pool.queueExists((req.params as any).name)
			rep.send(exists)
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/paused",
		handler: (req, rep) => {
			const paused = pool.isQueuePaused((req.params as any).name)
			rep.send(paused)
		}
	},
	// {
	// 	method: "GET",
	// 	url: "/v1/queue/:name/looping",
	// 	handler: (req, rep) => {
	// 		const looping = pool.isQueueLooping((req.params as any).name)
	// 		rep.send(looping)
	// 	}
	// }, 
	{
		method: "GET",
		url: "/v1/queue/:name/pause",
		handler: (req, rep) => {
			const time = parseInt((req.query as any).time)
			if (time && isNaN(time)) throw Error("time mus be a valid number")
			const queue = pool.getQueue((req.params as any).name)
			if (time) queue.pause(time)
			else queue.pause()
			rep.send()
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/start",
		handler: (req, rep) => {
			const queue = pool.getQueue((req.params as any).name)
			queue.start()
			rep.send()
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/ignored/:key",
		handler: (req, rep) => {
			const name = (req.params as any).name
			const key = (req.params as any).key
			const result = pool.isQueueKeyIgnored(name, key)
			rep.send(result)
		}
	}, {
		method: "GET",
		url: "/v1/queue/:name/ignore/:keys",
		handler: (req, rep) => {
			const name = (req.params as any).name
			const keys = (req.params as any).keys?.split(",")
			const queue = pool.getQueue(name)
			queue.ignoreKeys(keys)
			rep.send()
		}
	}]
}
