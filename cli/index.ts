import { Choiche, nicliPrompt } from "niclijs"
import { commands } from "./commands";


(async function () {
	while (true) {
		const { command, choiche } = await nicliPrompt("nsqcli >", commands)
		if (!choiche) console.log(" unknown command: ", command)
	}
})()

