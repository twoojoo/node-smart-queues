import * as readline from "node:readline/promises"
import * as qs from "node:querystring"

const port = parseInt(process.argv[2] || "80")
if (isNaN(port)) throw Error("port must be a valid number");

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

type Command = {
	description: string,
	usage: string,
	action: Function
}

(async function () {
	await testConnection(port)

	const url = "http://0.0.0.0:" + port + "/v1/"

	while (true) {
		const cmd = (await rl.question("> ")).split(" ")
		const command = cmd[0].toLowerCase()
		if (command != "help") {
			const cmdObj = commands(url)[command]

			if (!cmdObj) {
				console.log(`${command} is not a valid command`)
				continue
			}

			else console.log(await cmdObj.action(cmd))
		} else {
			if (!cmd[1]) {
				console.log()
				const output = Object.entries(commands(url)).map(([name, prop]) => {
					return ` ${name.toUpperCase()} - ${prop.description}\n\t\x1b[2m${prop.usage}\x1b[0m`
				}).join("\n")
				console.log(output)
				console.log()
			} else {
				const cmdObj = commands(url)[cmd[1]]

				if (!cmdObj) {
					console.log(`${cmd[1]} is not a valid command`)
					continue
				}

				console.log("description: ", cmdObj.description)
				console.log("usage:       ", cmdObj.usage)
			}
		}
	}
})()

async function testConnection(port: number) {
	const res = await request("http://0.0.0.0:" + port + "/v1/ping")
	// if (await res?.text() != "pong") throw Error("an error occurred during connection test")
} 

function commands(url: string): { [name: string]: Command } {
	return {
		list: {
			description: "gets the names of the queues registered in the pool (comma separated)",
			usage: "list",
			action: async (cmd: string[]) => { 
				const resp = await (await request(url + "queue")).text()
				return resp
			}
		},
		exists: {
			description: "tells if a queue exists in the pool(true/false)",
			usage: "exists <queue-name>",
			action: async (cmd: string[]) => { 
				const name = cmd[1]
				if (!name) return "no queue name provided"
				const resp = await (await request(url + "queue/" + name + "/exists")).text()
				return resp
			}
		},
		paused: {
			description: "tells if a queue is paused or not",
			usage: "paused <queue-name>",
			action: async (cmd: string[]) => {
				const name = cmd[1]
				if (!name) return "no queue name provided"
				const resp = await (await request(url + "queue/" + name + "/paused")).text()
				return resp
			}
		},
		pause: {
			description: "pauses a queue (optional pause timeout in ms)",
			usage: "pause <queue-name>",
			action: async (cmd: string[]) => {
				const name = cmd[1]
				const time = cmd[2]
				if (!name) return "no queue name provided"
				const resp = await (time ? 
					await request(url + "queue/" + name + "/pause?time=" + time) :
					await request(url + "queue/" + name + "/pause")).text()
				return resp
			}
		},
		start: {
			description: "starts a queue",
			usage: "start <queue-name>",
			action: async (cmd: string[]) => {
				const name = cmd[1]
				if (!name) return "no queue name provided"
				const resp = await (await request(url + "queue/" + name + "/start")).text()
				return resp
			}
		},
		ignore: {
			description: "commands a queue to ignore a list of keys (comma separated)",
			usage: "ignore <queue-name> <key1>,<key2>,<key3>",
			action: async (cmd: string[]) => {
				const name = cmd[1]
				const keys = cmd[2]
				if (!name) return "no queue name provided"
				if (!keys) return "no keys provided"
				const resp = await (await request(url + "queue/" + name + "/ignore/" + keys)).text()
				return resp
			}
		},
		ignored: {
			description: "tells if a key is ignored by a queue",
			usage: "ignored <queue-name> <key-name>",
			action: async (cmd: string[]) => {
				const name = cmd[1]
				const key = cmd[2]
				if (!name) return "no queue name provided"
				if (!key) return "no key provided"
				const resp = await (await request(url + "queue/" + name + "/key/" + key + "/ignored")).text()
				return resp
			}
		},
		state: {
			description: "gets the number of pending jobs in a queue for every key (or for a specific key)",
			usage: "state <queue-name> <key-name> [optional]",
			action: async (cmd: string[]) => {
				const name = cmd[1]
				const key = cmd[2]
				if (!name) return "no queue name provided"
				const resp = await (!key ?
					await request(url + "queue/" + name + "/state") :
					await request(url + "queue/" + name + "/key/" + key + "/state")).text()
				return resp
			}
		},
		mode: {
			description: "gets the queue mode (FIFO/LIFO) for the queue key or for a specific key",
			usage: "mode <queue-name> <key-name> [optional]",
			action: async (cmd: string[]) => {
				const name = cmd[1]
				const key = cmd[2]
				if (!name) return "no queue name provided"
				const resp = await (!key ?
					await request(url + "queue/" + name + "/mode") :
					await request(url + "queue/" + name + "/key/" + key + "/mode")).json()
				return Object.entries(resp).map(([name, mode]) => `${name}: ${mode}`).join("\n")
			}
		},
		enqueue: {
			description: "push an item to a queue with a key",
			usage: "push <queue-name> <key-name> <item-content> <item-type> [json/string/number (default: string)]",
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
		},
		// delay: {
		// 	description: "sets an interval for the queue or for a specific key",
		// 	usage: "delay <queue-name> <key-name> <item-content> <item-type> [json/string/number (default: string)]",
		// 	action: async (cmd: string[]) => {
		// 		const name = cmd[1]
		// 		const key = cmd[2]
		// 		const time = cmd[3]
		// 		if (!name) return "no queue name provided"
		// 		if (!key) return "no key provided ('*' refers to all keys)"
		// 		if (!time) return "no time provided"
		// 		if (isNaN(parseInt(time))) return "time must be a valid number"
		// 		const queryString = qs.stringify({ time })
		// 		const resp = await (key == ALL_KEYS_CH ?
		// 			await request(url + "queue/" + name + "/interval?" + queryString) :
		// 			await request(url + "queue/" + name + "/key/" + key + "/interval?" + queryString)).text() 
		// 		return resp
		// 	}
		// },
		exit: {
			description: "exit the cli",
			usage: "exit",
			action: async (cmd: string[]) => process.exit(0)
		}
	};
}

function request(...args: any[]) {
	return { text: () => { return { resp: undefined } }, json: () => { return { resp: undefined } } }
}