import { QueueItem, QueueKind, StorageShiftOutput } from "../types"
import { registerNewStorage } from "../pool"
import { Storage } from "./Storage"
import fs from "fs"

const SEPARATOR = "§çn§çq§çs§çsep§ç"
const LINE_END = SEPARATOR + "\n"

export class FileSystemStorage<T = any> extends Storage<T> {
	private file: string

	constructor(name: string, file: string) {
		super(name)
		this.file = file
		const fileExists = fs.existsSync(file)
		if (!fileExists) fs.writeFileSync(file, "")
		registerNewStorage(this)
	}

	async push(key: string, item: QueueItem<T>): Promise<void> {
		fs.appendFileSync(this.file, this.name + SEPARATOR + key + SEPARATOR + item.pushTimestamp + SEPARATOR + JSON.stringify(item.value) + LINE_END)
	}

	async shiftFIFO(key: string, count: number): Promise<StorageShiftOutput<T>> {
		return this.shift("FIFO", key, count)
	}

	async shiftLIFO(key: string, count: number): Promise<StorageShiftOutput<T>> {
		return this.shift("LIFO", key, count)
	}

	async shift(kind: QueueKind, key: string, count: number): Promise<StorageShiftOutput<T>> {
		let storage: any[] = fs
			.readFileSync(this.file)
			.toString()
			.split(LINE_END)

		if (storage[storage.length - 1] == '') storage.splice(storage.length - 1, 1)

		const globalStorage = []
		const queueStorage = storage.flatMap(item => {
			const itemComponents = item.split(SEPARATOR)
			globalStorage.push(itemComponents)
			if (itemComponents[0] == this.name) return [itemComponents]
			else return []
		})

		const storedCount = {}
		queueStorage.forEach(itemComponents => {
			const key = itemComponents[1]
			if (!storedCount[key]) storedCount[key] = 0
			storedCount[key]++
		})

		const keyStorage = queueStorage
			.filter(item => item[1] == key)

		const keyStorageJoined = keyStorage.map(i => i.join(SEPARATOR))
		const newStorage = globalStorage.flatMap((item) => {
			const relativeIndex = keyStorageJoined.indexOf(item.join(SEPARATOR))
			if (this.name == item[0] && item[1] == key && kind == "FIFO" && relativeIndex < count) return []
			if (this.name == item[0] && item[1] == key && kind == "LIFO" && relativeIndex >= keyStorageJoined.length - count) return []
			else {
				const joinedItem = item.join(SEPARATOR)
				if (joinedItem.endsWith(LINE_END)) return joinedItem
				else return joinedItem + LINE_END
			}
		})

		const items: QueueItem<T>[] = (
			kind == "FIFO" ? 
				keyStorage.splice(0, count) :
				keyStorage.splice(keyStorage.length - count, count)
		).map(itemComponents => ({
			pushTimestamp: parseInt(itemComponents[2]),
			value: JSON.parse(itemComponents[3])
		}))

		if (newStorage[storage.length - 1] == '') newStorage.splice(newStorage.length - 1, 1)
		fs.writeFileSync(this.file, newStorage.join(""))

		return {
			items,
			storedCount
		}
	}
}