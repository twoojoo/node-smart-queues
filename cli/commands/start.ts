import { Choiche, colors } from "niclijs"
import { request } from "../request"

export const start: Choiche = {
	command: "START",
	description: "starts a queue (or resumes it)",
	action: async (cmd: string[]) => {
		const name = cmd[0]

		if (!name) console.error("no queue name provided")
		else await (await request(global.url + "queue/" + name + "/start")).text()
	}
}