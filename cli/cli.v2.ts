import { Command } from "commander";
import axios from "axios";

const program = new Command("nicli")

program
	.command("list", "gets the names of the queues registered in the pool (comma separated)")
	.option("-u, --url <string>", "target URL")
	.action(async (options) => {
		const url = options.url || "http://localhost:4321"
		const response = await makeRequest(() => axios.get(url + "/queue"))
		console.log(response)
	})

async function makeRequest(request: () => Promise<{ data: any }>) {
	try {
		return (await request()).data
	} catch (err) {
		throw Error(err.response?.data)
	}
}

program.parse()