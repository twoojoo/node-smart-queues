// import { FileSystemStorage } from "./FileSystem"
import { MemoryStorage } from "./Memory"
import { RedisSetStorage } from "./RedisSet"
import { RedisListStorage } from "./RedisList"
import { RedisOptions } from "ioredis"
import { TTLOptions } from "../types"

export function redisStorage(redis: RedisOptions & TTLOptions) {
	return (name: string) => new RedisSetStorage(name, redis)
}

export function redisListStorage(redis: RedisOptions) {
	return (name: string) => new RedisListStorage(name, redis)
}

// export function fileSystemStorage(file: string) {
// 	return (name: string) => new FileSystemStorage(name, file)
// }

export function inMemoryStorage(opts: TTLOptions = {}) {
	return (name: string) => new MemoryStorage(name, opts)
}