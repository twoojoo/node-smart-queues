import { Choiche } from "niclijs"

const url = "http://0.0.0.0:3000/v1/"

export const commands: Choiche[] = [{
	command: "LIST",
	description: "gets the names of the queues registered in the pool (comma separated)",
	action: async (_) => {
		const resp = await(await request(url + "queue"))?.text()
		console.log(resp)
	}
}, {
	command: "EXIT",
	description: "exit the cli",
	action: async (cmd: string[]) => process.exit(0)
}];

async function request(url: string): Promise<Response> {
	const log = console.error
	try {
		console.log("\x1b[2mfetching", "'" + url + "'...\x1b[0m")
		console.error = () => {}
		const response = await fetch(url)
		console.error = log
		return response
	} catch (err) {
		console.error = log
		console.log(err)
		// console.error("an error occurred")
		// return 
	}
}
