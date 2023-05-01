import { Choiche, colors } from "niclijs"
import { request } from "../request"

export const exists: Choiche = {
	command: "EXISTS",
	description: "tells if a queue exists by name",
	action: async (args: string[]) => { 
		const name = args[0]

		if (!name) console.error("no queue name provided")
		else {
			const resp = await (await request(global.url + "queue/" + name + "/exists")).text()
			console.log(resp)
		}
	}
}