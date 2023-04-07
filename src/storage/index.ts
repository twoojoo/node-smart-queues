import { FileSystemStorage } from "./FileSystem"
import { MemoryStorage } from "./Memory"
import { RedisStorage } from "./Redis"
import { RedisOptions } from "ioredis"

export function redisStorage(redis: RedisOptions) {
	return (name: string) => new RedisStorage(name, redis)
}

export function fileSystemStorage(file: string) {
	return (name: string) => new FileSystemStorage(name, file)
}

export function inMemoryStorage() {
	return (name: string) => new MemoryStorage(name)
}