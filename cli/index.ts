import { nicliPrompt } from "niclijs"
import { commands, testConnection } from "./commands";


(async function () {
	await testConnection()
	setInterval(() => testConnection(), 2000)
	
	while (true) {
		const { command, choiche, exit } = await nicliPrompt("nsqcli >", commands)
		if (exit) process.exit(0)
		if (!choiche) console.log(" unknown command: ", command)
	}
})()

