import { colors, nicliPrompt } from "niclijs"
import { testConnection } from "./request";
import { commands } from "./commands";

const DEFAULT_URL = "http://0.0.0.0:3000";

(async function () {
	//setup server url
	const baseUrl = process.env.NSQ_URL || DEFAULT_URL
	console.log(colors.FgLightGrey("connecting to " + baseUrl))
	global.url = baseUrl + "/v1/"

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

