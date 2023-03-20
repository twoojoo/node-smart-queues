import { QueuePool } from "../src/types"
import { getRoutes } from "./routes"
import Fastify, {} from "fastify"

export type NsqHttpOptions = {
	host?: string,
	port?: number,
	logger?: boolean
}

export type NsqInterfaceConfig = {
	host: string,
	port: number
}

export function nsqHttpInterface(pool: QueuePool, options: NsqHttpOptions = {}): Promise<NsqInterfaceConfig> {
	return new Promise((resolve, reject) => {
		const nsqServer = Fastify({ logger: false });

		const host = options.host || "0.0.0.0"
		const port = options.port || 80

		getRoutes(pool)
			.forEach(r => nsqServer.route(r))

		nsqServer.listen({ host, port }, (err, addr) => {
			if (err) reject(err)
			else options.logger && console.log(new Date(), `#> nsq rest server listening at`, addr)
			resolve({ host, port })
		})
	})
}

