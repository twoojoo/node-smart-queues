import { Choiche, colors } from "niclijs"
import * as qs from "node:querystring"
import { request } from "../request"

export const enqueue: Choiche = {
	command: "ENQUEUE",
	description: "push an item to a queue with a key",
	action: async (cmd: string[]) => {
		const name = cmd[0]
		const key = cmd[1]
		const item = cmd[2]
		const kind = cmd[3]

		if (!name) {
			console.error("no queue name provided"); 
			return
		}

		if (!key) {
			console.error("no key provided"); 
			return
		}

		if (!kind) console.log(colors.FgLightGrey("no kind provided (defatul: string)"))

		const queryString = qs.stringify({ item, kind })
		const resp = await (await request(global.url + "queue/" + name + "/key/" + key + "/enqueue?" + queryString)).json() 

		console.log("enqueued:", resp.enqueued)
		console.log("code:", resp.code)
		console.log("message:", resp.message)
		if (resp.error) console.error("error:", resp.error)
	}
}