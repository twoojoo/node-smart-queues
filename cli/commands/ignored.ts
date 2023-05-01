import { Choiche, colors } from "niclijs"
import { request } from "../request";

export const ignored: Choiche = {
	command: "IGNORED",
	description: "tells if a key is ignored by a queue",
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
		
		const resp = await (await request(global.url + "queue/" + name + "/key/" + key + "/ignored")).text()
		console.log(resp)
	}
}