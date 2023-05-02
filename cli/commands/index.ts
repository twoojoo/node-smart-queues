import { Choiche, colors } from "niclijs";
import { list } from "./list";
import { exists } from "./exists";
import { pause } from "./pause";
import { start } from "./start";
import { exit } from "./exit";
import { ignore } from "./ignore";
import { restore } from "./restore";
import { ignored } from "./ignored";
import { pending } from "./pending";
import { mode } from "./mode";
import { enqueue } from "./enqueue";
import { paused } from "./paused";
import { block } from "./block";
import { release } from "./release";
import { blocked } from "./blocked";
import { flush } from "./flush";

const commandsPartial: Choiche[] = [
	list,
	exists,
	pause,
	start,
	exit,
	ignore,
	restore,
	ignored,
	pending,
	mode,
	enqueue,
	paused,
	block,
	release,
	blocked,
	flush
]

export const commands = commandsPartial.concat([{
	command: "HELP",
	description: "prints a list of all available commands",
	action: () => {
		console.log("\nAvailable commands:")
		commandsPartial.forEach(cmd => { 
			console.log(cmd.command, colors.FgLightGrey(cmd.description))
		})
		console.log()
	}
}])