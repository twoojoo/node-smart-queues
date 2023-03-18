# Node Smart Queues

## Features

- Stateful
- Crash safe (recovery)
- Jobs keys
- Delayed jobs
- Concurrent queues
- Priorities
- Randomizable
- FIFO / LIFO 
- Queues pool
- Compression
- Fluent interface
- Typescript first

## Installation

```bash
npm install node-smart-queues
```

## Basic usage

This example shows a simple queue where pushed jobs will come out every second.

```typescript
import { SmartQueue } from "node-smart-queues"

const queue = SmartQueue<number>("my-queue")
	.logger(true)
	.setDelay("my-key", 1000)
	.onFlush("my-key", (i, k, q) => console.log(`flushed item ${i} with key ${k} from queue ${q}`))
	.start();

(async function() {
	await queue.push("my-key", 1)
	await queue.push("my-key", 2)
	await queue.push("my-key", 3)
})()
```

## Stateful

Smart Queues use an in-memory storage system by default (not crash safe), but you can change this setting by using a different storage system. When using a safe storage system, the queue will automatically recover the hanging state as the program gets restarted. 

### File System Storage

Will save the queue state in the provided file (will create it if it doesn't exist yet). The same file can be shared by multiple concurrent queues. If the file already exists it must be empty on the first run.

```typescript
const queue = SmartQueue<number>("my-queue")
	.fileSystemStorage("./file.txt")
	.setDelay("my-key", 1000)
	.onFlush("my-key", (i) => console.log(i)
	.start();
```

### Redis Storage

Will use Redis' lists as storage system. An [ioredis]() client must be provideded to the queue. If the items pushed to the queue may be bigger than 512MB (max redis storage size), consider using the compression system (gzip) shipped with the queue system.

```typescript
import { Redis } from "ioredis"

const redis = new Redis({
	host: "localhost",
	port: 6379
})

const queue = SmartQueue<number>("my-queue")
	.redisStorage(redis)
	.setDelay("my-key", 1000)
	.onFlush("my-key", (i) => console.log(i)
	.start();
```