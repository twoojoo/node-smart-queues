import { testConnection } from "./request";
import { nicliPrompt } from "niclijs"
import { commands } from "./commands";

const DEFAULT_URL = "http://0.0.0.0:3000";

(async function () {
	//setup server url
	global.url = (process.argv[2] || DEFAULT_URL) + "/v1/"

	//test connection at startup
	//and every 2 seconds
	await testConnection()
	setInterval(() => testConnection(), 2000)
	
	//listen for commands via niclijs
	while (true) {
		const { command, choiche, exit } = await nicliPrompt("nsqcli >", commands)
		if (exit) process.exit(0)
		if (!choiche) console.log(" unknown command: ", command)
	}
})()

