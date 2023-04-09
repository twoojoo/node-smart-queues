import { Choiche, colors } from "niclijs"

const url = "http://0.0.0.0:3000/v1/"

export const commands: Choiche[] = [{
	command: "LIST",
	description: "gets the names of the queues that are registered in the pool",
	action: async (_) => {
		const resp = await (await request(url + "queue"))?.text()
		console.log(resp)
	}
}, {
	command: "EXISTS",
	description: "tells if a queue exists by name",
	action: async (args: string[]) => { 
		const name = args[0]
		if (!name) console.log("no queue name provided")
		else {
			const resp = await (await request(url + "queue/" + name + "/exists")).text()
			console.log(resp)
		}
	}
}, {
	command: "PAUSE",
	description: "pauses a queue (optional pause timeout in ms)",
	action: async (cmd: string[]) => {
		const name = cmd[0]
		const time = cmd[1]
		if (!name) console.log("no queue name provided")
		else await (time ? 
			await request(url + "queue/" + name + "/pause?time=" + time) :
			await request(url + "queue/" + name + "/pause")).text()
		
	}
}, {
	command: "START",
	description: "starts a queue (or resumes it)",
	action: async (cmd: string[]) => {
		const name = cmd[0]
		if (!name) console.log("no queue name provided")
		else await (await request(url + "queue/" + name + "/start")).text()
	}
}, {
	command: "EXIT",
	description: "exit the cli",
	action: async (cmd: string[]) => process.exit(0)
}];

export async function testConnection() {
	const response = await (await request(url + "ping"))?.text()
	if (response != "pong") {
		console.error(("Error: can't connect to the nsq server"))
		process.exit(1)
	}
}

async function request(url: string): Promise<Response> {
	const log = console.error
	try {
		// console.log(colors.FgLightGrey("fetching " + "'" + url + "'..."))
		console.error = () => {}
		const response = await fetch(url)
		console.error = log
		return response
	} catch (err) {
		console.error = log
		// console.log(err)
		// console.error("an error occurred")
		// return 
	}
}
