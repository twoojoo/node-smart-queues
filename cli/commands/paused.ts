import { Choiche, colors } from "niclijs"
import { request } from "../request"

export const paused: Choiche = {
	command: "PAUSED",
	description: "tells if a queue is paused",
	action: async (cmd: string[]) => {
		const name = cmd[0]

		if (!name) console.error("no queue name provided")
		else console.log((await (await request(global.url + "queue/" + name + "/paused")).text()))
	}
}