import * as readline from "node:readline/promises"
import * as qs from "node:querystring"

const port = parseInt(process.argv[2] || "80")
if (isNaN(port)) throw Error("port must be a valid number");

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

(async function () {
	await testConnection(port)

	const v1URL = "http://localhost:" + port + "/v1/"

	while (true) {
		const cmd = (await rl.question("#> ")).split(" ")
		let resp: string
		let name: string 
		switch (cmd[0]) {
			case "list": 
				resp = await request(v1URL + "queue")
				console.log(resp)
				break

			case "exists": 
				name = cmd[1]
				resp = await request(v1URL + `queue/${name}/exists`)
				console.log(resp)
				break

			case "paused":
				name = cmd[1]
				resp = await request(v1URL + `queue/${name}/paused`)
				console.log(resp)
				break

			case "pause":
				name = cmd[1]
				const time = parseInt(cmd[2])
				const query = qs.stringify({ time })
				resp = await request(v1URL + `queue/${name}/pause?${query}`)
				console.log(resp)
				break

			case "start":
				name = cmd[1]
				resp = await request(v1URL + `queue/${name}/start`)
				console.log(resp)
				break

			case "ignored":
				name = cmd[1]
				const ignoredKey = cmd[4]
				resp = await request(v1URL + `queue/${name}/ignored/${ignoredKey}`)
				console.log(resp)
				break

			case "ignore":
				name = cmd[1]
				const keyToIgnore = cmd[2]
				resp = await request(v1URL + `queue/${name}/ignore/${keyToIgnore}`)
				console.log(resp)
				break

			case "state":
				name = cmd[1]
				const stateKey = cmd[2]
				if (stateKey) resp = await request(v1URL + `queue/${name}/state/${stateKey}`)
				else resp = await request(v1URL + `queue/${name}/state`)
				console.log(resp)
				break

			case "mode":
				name = cmd[1]
				const modeKey = cmd[2]
				if (modeKey) resp = await request(v1URL + `queue/${name}/mode/${modeKey}`)
				else resp = await request(v1URL + `queue/${name}/mode`)
				console.log(resp)
				break

			case "exit":
				process.exit(0)

			default:
				console.log("unknown command:", cmd[0])
				break
		}
	}
})()

async function testConnection(port: number) {
	const res = await request("http://0.0.0.0:" + port + "/v1/ping")
	if (res != "pong") throw Error("an error occurred during connection test")
} 

async function request(url: string): Promise<string> {
	try {
		console.log(url)
		const log = console.error
		console.error = () => {}
		const response = await fetch(url)
		console.error = log
		return await response.text()
	} catch (err) {
		console.error("an error occurred")
		return ""
	}
}