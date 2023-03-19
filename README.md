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
- Fluent syntax
- HTTP interface
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

Smart Queues use an in-memory storage system by default (not crash safe), but you can change this setting by using a different storage system. When using a safe storage system, the queue will automatically recover the hanging state as soon as the program gets restarted. 

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

Will use Redis' lists as storage system. An [ioredis](https://github.com/luin/ioredis) client must be provideded to the queue. If you think that the items pushed to the queue may be bigger than 512MB (maximum Redis record size), consider using the compression (gzip) shipped with the queue system.

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

## HTTP interface

To interact with all the queues in the pool via the built-in HTTP interface, you have to import the interface builder and pass the QueuePool object to it, along with some options. It will automatically setup a [fastify]() server that exposes some useful endpoints.

```typescript
import { QueuesPool, SmartQueue } from "node-smart-queues"
import { nsqHttpInterface } from "node-smart-queues-http"

(async function () {
	await nsqHttpInterface(QueuesPool, {port: 3000, logger: true})

	const q = SmartQueue<string>("q1")
		.onFlushAsync("*", (i) => console.log(i))
		.start();

	while(true) { //push 1 message every second
		await new Promise(r => setTimeout(() => r(0), 1000))
		await q.push(`k1`, "message")
	}
})()
```

### HTTP commands

A list of the available HTTP commands in curl syntax:

```bash
# lists queue in the pool (comma separated)
curl http://localhost:3000/v1/queue

# tells if a queue exissts or not
curl http://localhost:3000/v1/queue/<name>/exists

# tells if a queue is paused
curl http://localhost:3000/v1/queue/<name>/paused

#pauses a queue for n millisecods (or indefinitely if time is not provided)
curl http://localhost:3000/v1/queue/<name>/pause?time=<ms>

# starts a queue (or restarts it if the queue is paused)
curl http://localhost:3000/v1/queue/<name>/start

# tells if a key is ignored by a queue
curl http://localhost:3000/v1/queue/<name>/ignored/<key>

# tells a queue to ignore a list of key (comma separated)
curl http://localhost:3000/v1/queue/<name>/ignore/<keys>
```