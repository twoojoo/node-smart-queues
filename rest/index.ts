import { QueuePool } from "../src/types"
import { getRoutes } from "./routes"
import Fastify, {} from "fastify"

export type NsqHttpOptions = {
	host?: string,
	port?: number,
	logger?: boolean
}

export function nsqHttpInterface(pool: QueuePool, options: NsqHttpOptions = {}) {
	return new Promise((resolve, reject) => {
		const nsqServer = Fastify({ logger: false });

		getRoutes(pool)
			.forEach(r => nsqServer.route(r))

		nsqServer.listen({
			host: options.host || "0.0.0.0",
			port: options.port || 80
		}, (err, addr) => {
			if (err) reject(err)
			else options.logger && console.log(new Date(), `#> nsq rest server listening at`, addr)
			resolve(0)
		})
	})
}

