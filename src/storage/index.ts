// import { FileSystemStorage } from "./FileSystem"
import { MemoryStorage } from "./Memory"
import { RedisStorage } from "./Redis"
import { RedisOptions } from "ioredis"
import { TTLOptions } from "../types"

export function redisStorage(redis: RedisOptions & TTLOptions) {
	return (name: string) => new RedisStorage(name, redis)
}

// export function fileSystemStorage(file: string) {
// 	return (name: string) => new FileSystemStorage(name, file)
// }

export function inMemoryStorage(opts: TTLOptions = {}) {
	return (name: string) => new MemoryStorage(name, opts)
}