import { Choiche, colors } from "niclijs"
import { request } from "../request";

export const block: Choiche = {
	command: "BLOCK",
	description: "commands a queue to both ignore and stop dequeuing a list of keys (comma separated)",
	action: async (cmd: string[]) => {
		const name = cmd[0]
		const keys = cmd[1]

		if (!name) { 
			console.error("no queue name provided"); 
			return
		}

		if (!keys) { 
			console.error("no keys provided");
			return
		}

		const resp = await (await request(global.url + "queue/" + name + "/block/" + keys)).text()
		console.log(resp)
	}
}