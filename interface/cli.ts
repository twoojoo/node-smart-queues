import * as readline from "node:readline/promises"
// import * as qs from "node:querystring"

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
	if (res != "pong") throw Error("an error occurred during connection test")
} 

async function request(url: string): Promise<string> {
	const log = console.error
	try {
		console.log("\x1b[2mfetching", "'" + url + "'...\x1b[0m")
		console.error = () => {}
		const response = await fetch(url)
		console.error = log
		return await response.text()
	} catch (err) {
		console.error = log
		// console.log(err)
		console.error("an error occurred")
		return ""
	}
}

function commands(url: string): { [name: string]: Command } {
	return {
		list: {
			description: "gets the names of the queues registered in the pool (comma separated)",
			usage: "list",
			action: async (cmd: string[]) => { 
				const resp = await request(url + "queue")
				return resp
			}
		},
		exists: {
			description: "tells if a queue exists in the pool(true/false)",
			usage: "exists <queue-name>",
			action: async (cmd: string[]) => { 
				const name = cmd[1]
				if (!name) return "no queue name provided"
				const resp = await request(url + "queue/" + name + "/exists")
				return resp
			}
		},
		paused: {
			description: "tells if a queue is paused or not",
			usage: "paused <queue-name>",
			action: async (cmd: string[]) => {
				const name = cmd[1]
				if (!name) return "no queue name provided"
				const resp = await request(url + "queue/" + name + "/paused")
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
				const resp = time ? 
					await request(url + "queue/" + name + "/pause?time=" + time) :
					await request(url + "queue/" + name + "/pause")
				return resp
			}
		},
		start: {
			description: "starts a queue",
			usage: "start <queue-name>",
			action: async (cmd: string[]) => {
				const name = cmd[1]
				if (!name) return "no queue name provided"
				const resp = await request(url + "queue/" + name + "/start")
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
				const resp = await request(url + "queue/" + name + "/ignore/" + keys)
				return resp
			}
		},
		ignored: {
			description: "tells if a key is ignored by a queue",
			usage: "paused <queue-name> <key-name>",
			action: async (cmd: string[]) => {
				const name = cmd[1]
				const key = cmd[2]
				if (!name) return "no queue name provided"
				if (!key) return "no key provided"
				const resp = await request(url + "queue/" + name + "/key/" + key + "/ignored")
				return resp
			}
		},
		state: {
			description: "gets the number of pending jobs in a queue for every key (or for a specific key)",
			usage: "paused <queue-name> <key-name> [optional]",
			action: async (cmd: string[]) => {
				const name = cmd[1]
				const key = cmd[2]
				if (!name) return "no queue name provided"
				const resp = !key ?
					await request(url + "queue/" + name + "/state") :
					await request(url + "queue/" + name + "/key/" + key + "/state") 
				return resp
			}
		},
		exit: {
			description: "exit the cli",
			usage: "exit",
			action: async (cmd: string[]) => process.exit(0)
		}
	};
}