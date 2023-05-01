import { Choiche, colors } from "niclijs"
import { request } from "../request";

export const pending: Choiche = {
	command: "PENDING",
	description: "gets the number of pending jobs in a queue for every key (or for a specific key)",
	action: async (cmd: string[]) => {
		const name = cmd[0]
		const key = cmd[1]

		if (!name) { 
			console.log("no queue name provided"); 
			return
		}

		const resp = await (!key ?
			await request(global.url + "queue/" + name + "/pending") :
			await request(global.url + "queue/" + name + "/key/" + key + "/pending")).json()

		if (typeof resp == "number") {
			console.log(resp)
		} else {
			Object.entries(resp).forEach(([key, count]) => console.log(`${key}:`, count))
		}
	}
}