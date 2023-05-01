import { Choiche, colors } from "niclijs"
import { request } from "../request";

export const blocked: Choiche = {
	command: "BLOCKED",
	description: "tells if a key is blocked within a queue",
	action: async (cmd: string[]) => {
		const name = cmd[0]
		const key = cmd[1]

		if (!name) { 
			console.error("no queue name provided"); 
			return
		}

		if (!key) { 
			console.error("no key provided");
			return
		}

		const resp = await (await request(global.url + "queue/" + name + "/blocked/" + key)).text()
		console.log(resp)
	}
}