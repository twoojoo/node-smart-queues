import { colors } from "niclijs"

export async function testConnection() {
	const response = await (await request(global.url + "ping"))?.text()
	if (response != "pong") {
		console.error(("Error: can't connect to the nsq server"))
		process.exit(1)
	}
}

export async function request(url: string): Promise<Response> {
	const log = console.error
	try {
		console.error = () => {}
		const response = await fetch(url)
		console.error = log
		return response
	} catch (err) {
		//connections error should be catch via the
		//test connection function (periodic)
		console.error = log
	}
}