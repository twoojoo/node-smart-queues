import { Choiche, colors } from "niclijs"
import { request } from "../request";

export const flush: Choiche = {
	command: "FLUSH",
	description: "commands a queue to flush all items or specific keys' items",
	action: async (cmd: string[]) => {
		const name = cmd[0]
		const keys = cmd[1]

		if (!name) { 
			console.error("no queue name provided"); 
			return
		}

		let resp

		if (keys) {
			resp = await (await request(global.url + "queue/" + name + "/flush/" + keys)).text()
		} else {
			resp = await (await request(global.url + "queue/" + name + "/flush")).text()
		}

		console.log(resp)
	}
}