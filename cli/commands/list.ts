import { Choiche, colors } from "niclijs"
import { request } from "../request"

export const list: Choiche = {
	command: "LIST",
	description: "gets the names of the queues that are registered in the pool",
	action: async (_) => {
		const resp = await (await request(global.url + "queue"))?.text()
		console.log(resp)
	}
}