import { Choiche, colors } from "niclijs"
import * as qs from "node:querystring"

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
}, {
	command: "IGNORE",
	description: "commands a queue to ignore a list of keys (comma separated)",
	action: async (cmd: string[]) => {
		const name = cmd[1]
		const keys = cmd[2]
		if (!name) return "no queue name provided"
		if (!keys) return "no keys provided"
		const resp = await (await request(url + "queue/" + name + "/ignore/" + keys)).text()
		return resp
	}
}, {
	command: "IGNORED",
	description: "tells if a key is ignored by a queue",
	action: async (cmd: string[]) => {
		const name = cmd[1]
		const key = cmd[2]
		if (!name) return "no queue name provided"
		if (!key) return "no key provided"
		const resp = await (await request(url + "queue/" + name + "/key/" + key + "/ignored")).text()
		return resp
	}
}, {
	command: "STATE",
	description: "gets the number of pending jobs in a queue for every key (or for a specific key)",
	action: async (cmd: string[]) => {
		const name = cmd[1]
		const key = cmd[2]
		if (!name) return "no queue name provided"
		const resp = await (!key ?
			await request(url + "queue/" + name + "/state") :
			await request(url + "queue/" + name + "/key/" + key + "/state")).text()
		return resp
	}
}, {
	command: "MODE",
	description: "gets the queue mode (FIFO/LIFO) for the queue key or for a specific key",
	action: async (cmd: string[]) => {
		const name = cmd[1]
		const key = cmd[2]
		if (!name) return "no queue name provided"
		const resp = await (!key ?
			await request(url + "queue/" + name + "/mode") :
			await request(url + "queue/" + name + "/key/" + key + "/mode")).json()
		return Object.entries(resp).map(([name, mode]) => `${name}: ${mode}`).join("\n")
	}
}, {
	command: "ENQUEUE",
	description: "push an item to a queue with a key",
	action: async (cmd: string[]) => {
		const name = cmd[1]
		const key = cmd[2]
		const item = cmd[3]
		const kind = cmd[4]
		if (!name) return "no queue name provided"
		if (!key) return "no key provided"
		if (!kind) console.log("no kind provided (defatul: string)")
		const queryString = qs.stringify({ item, kind })
		const resp = await (await request(url + "queue/" + name + "/key/" + key + "/enqueue?" + queryString)).json() 
		return resp
	}
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
