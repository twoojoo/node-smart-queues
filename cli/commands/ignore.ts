import { Choiche, colors } from "niclijs"
import { request } from "../request";

export const ignore: Choiche = {
	command: "IGNORE",
	description: "commands a queue to ignore a list of keys (comma separated)",
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

		const resp = await (await request(global.url + "queue/" + name + "/ignore/" + keys)).text()
		console.log(resp)
	}
}