import { Choiche, colors } from "niclijs"
import { request } from "../request";

export const mode: Choiche = {
	command: "MODE",
	description: "gets the queue mode (FIFO/LIFO) for the queue key or for a specific key",
	action: async (cmd: string[]) => {
		const name = cmd[0]
		const key = cmd[1]

		if (!name) { 
			console.error("no queue name provided"); 
			return
		}

		const resp = await (!key ?
			await request(global.url + "queue/" + name + "/mode") :
			await request(global.url + "queue/" + name + "/key/" + key + "/mode")).json()

		const output = Object.entries(resp).map(([name, mode]) => `${name}: ${mode}`).join("\n")
		console.log(output)
	}
}