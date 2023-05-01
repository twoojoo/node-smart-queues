import { Choiche, colors } from "niclijs"

export const exit: Choiche = {
	command: "EXIT",
	description: "exit the cli",
	action: async (cmd: string[]) => process.exit(0)
}