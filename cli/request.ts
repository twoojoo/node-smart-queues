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