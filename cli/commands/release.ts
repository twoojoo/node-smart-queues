import { Choiche, colors } from "niclijs"
import { request } from "../request";

export const release: Choiche = {
	command: "RELEASE",
	description: "commands a queue to release a list of previously blocked keys (comma separated)",
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

		const resp = await (await request(global.url + "queue/" + name + "/release/" + keys)).text()
		console.log(resp)
	}
}