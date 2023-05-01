import { Choiche, colors } from "niclijs"
import { request } from "../request"

export const pause: Choiche = {
	command: "PAUSE",
	description: "pauses a queue (optional pause timeout in ms)",
	action: async (cmd: string[]) => {
		const name = cmd[0]
		const time = cmd[1]

		if (!name) console.error("no queue name provided")
		else await (time ? 
			await request(global.url + "queue/" + name + "/pause?time=" + time) :
			await request(global.url + "queue/" + name + "/pause")).text()
	}
}