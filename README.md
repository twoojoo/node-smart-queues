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

To interact with all the queues in the pool via the built-in HTTP interface, you have to import the interface builder and pass the QueuePool object to it, along with some options. It will automatically setup a [fastify]() server that exposes some useful endpoints. It will also allow to control the queues via the nsq-cli.

```typescript
import { QueuesPool, SmartQueue } from "nsq"
import { setupInterface } from "nsq-interface"

(async function () {
	await setupInterface(QueuesPool, {
		port: 3000, //default: 80
		logger: true //default: false
	})

	const q = SmartQueue<string>("q1")
		.onFlushAsync("*", (i) => console.log(i))
		.start();

	while(true) { //push 1 message every second
		await new Promise(r => setTimeout(() => r(0), 1000))
		await q.push(`k1`, "message")
	}
})()
```

### HTTP interface

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

### CLI interface

Allows to control queues both locally or remotely via the command line (default address is *0.0.0.0:80*). It requires the HTTP interface to be up and running.

```bash
nsq-cli <address>
```

Type *help* in the cli to get the list of all available commands.

```
 LIST - gets the names of the queues registered in the pool (comma separated)
	list
 EXISTS - tells if a queue exists in the pool(true/false)
	exists <queue-name>
 PAUSED - tells if a queue is paused or not
	paused <queue-name>
 PAUSE - pauses a queue (optional pause timeout in ms)
	pause <queue-name>
 START - starts a queue
	start <queue-name>
 IGNORE - commands a queue to ignore a list of keys (comma separated)
	ignore <queue-name> <key1>,<key2>,<key3>
 IGNORED - tells if a key is ignored by a queue
	paused <queue-name> <key-name>
 STATE - gets the number of pending jobs in a queue for every key (or for a specific key)
	paused <queue-name> <key-name> [optional]
 EXIT - exit the cli
	exit
```