<p align="center" width="100%">
	<br>
  <img src="./images/logo_size_invert.jpg" width="100%" />
  <br>
  <br>
		<p align="center">A stateful queue system for Node.js<br>that focuses on <b>versatility</b>, <b>control</b> and <b>ease of use</b><p>
  </p>
	<br>
		<div width="100%" align="center"><b>Crash safe (automatic recovery)</b></div>
		<div width="100%" align="center"><b>Stateful (Redis, file system)</b></div>
		<div width="100%" align="center"><b>Concurrent queues</b></div>
		<div width="100%" align="center"><b>Timed dequeue</b></div>
		<div width="100%" align="center"><b>Typescript first</b></div>
		<div width="100%" align="center"><b>HTTP interface</b></div>
		<div width="100%" align="center"><b>Job key based</b></div>
		<div width="100%" align="center"><b>Queues Pool</b></div>
		<div width="100%" align="center"><b>FIFO / LIFO</b></div>
		<div width="100%" align="center"><b>Priorities</b></div>
		<div width="100%" align="center"><b>CLI</b></div>
	<br>
</p>

<br>

### Table of Contents
- [Installation](#installation)
- [Basic usage](#basic-usage)
- [Stateful](#stateful)
	- [File System Storage](#file-system-storage)
	- [Redis Storage](#redis-storage)
- [Options](#options)
- [HTTP / CLI interface](#http--cli-interface)
	- [Endpoints](#endpoints)
	- [CLI commands](#cli-commands)


<br>

## Installation

Base package:

```bash
npm install node-smart-queues
```

## Basic usage

This example shows a simple queue where enqueued jobs will be dequeued every second.

```typescript
import { Queue } from "node-smart-queues"

const queue = Queue<number>("my-queue", {
	logger: true,
	dequeueInterval: 1000,
	onDequeue: (i, k, q) => console.log(`dequeued item ${i} with key ${k} from queue ${q}`)
}).start();

(async function() {
	await queue.enqueue("my-key", 1)
	await queue.enqueue("my-key", 2)
	await queue.enqueue("my-key", 3)
})()
```

## Stateful

Smart Queues use an in-memory storage system by default (not crash safe), but you can change this setting by using a different storage system. When using a safe storage system, the queue will automatically recover the hanging state as soon as the program gets restarted. 

### File System Storage

Will save the queue state in the provided file (will create it if it doesn't exist yet). The same file can be shared by multiple concurrent queues. If the file already exists be sure it's empty on the first run.

```typescript
import { Queue, fileSystemStorage } from "node-smart-queues"

const queue = Queue<number>("my-queue", {
	storage: fileSystemStorage("/path/to/file"),
	dequeueInterval: 1000,
	onDequeue: i => console.log(i))
}).start();
```

### Redis Storage

Will use Redis' lists as storage system. [ioredis](https://github.com/luin/ioredis) options must be provideded. If you think that the items pushed to the queue may be bigger than 512MB (maximum Redis record size), consider using the compression (gzip) shipped with the queue system.

```typescript
import { Queue, redisStorage } from "node-smart-queues"

const queue = Queue<number>("my-queue", {
	storage: redisStorage({ host: "localhost", port: 6379 }),
	gzip: true,
	dequeueInterval: 1000,
	onDequeue: i => console.log(i))
}).start();
```

## Options

Queue options can be of two types:

- **Global**: valid for all job keys (ovveridden by single key-specific options)
- **Key-spcific**: valid for a single key (override the correspondant global property)

Here's an overview of all the available queue options:

```typescript
// global options
const q1 = new Queue<number>("q1", { 
	storage: redisStorage({ host: "localhost", port: 6379 }), //default memory
	logger: true, //defalut true
	gzip: true, //default false
	dequeueSize: 2, //default 1
	onDequeue: async (i, k, q) => console.log("success:", i, k, q),
	onDequeueAwait: false, //default true
	priority: ["k2", "k3", "k4"], 
	ignore: ["k5"],
	ignoreNotPrioritized: true, //default false
	randomPriority: false, //default false 
	ignoreItemCondition: i => i >= 12,
	dequeueInterval: 2000, //default 0
	maxRetry: 5, //default 1 attempt
	onMaxRetry: async (err, i, k, q) => console.log("error:", err, i, k, q),
	onMaxRetryAwait: true, //default false
	mode: "LIFO", //default FIFO
})

//key-specific options
q1.key("k1", {
	dequeueSize: 2,
	onDequeue: async (i, k, q) => console.log("success k2:", i, k, q),
	onDequeueAwait: false,
	ignoreItemCondition: i => i <= 3,
	dequeueInterval: 5000,
	maxRetry: 1,
	onMaxRetry: async (err, i, k, q) => console.log("error k2:", err, i, k, q),
	onMaxRetryAwait: false,
	mode: "FIFO",
})
```

## HTTP / CLI interface

To interact with all the queues in the pool via the built-in HTTP/CLI interface, you have to import the interface builder and pass the QueuePool object to it, along with some options. It will automatically setup a [fastify]() server that exposes some useful endpoints. It will also allow to control the queues via the **nsqcli**.

```bash
npm i node-smart-queues-http
```

```typescript
import { QueuesPool, Queue } from "node-smart-queues"
import { nsqServer } from "node-smart-queues-http"

await nsqHTTP(QueuesPool, {
	port: 3000, //default: 80
	logger: true //default: false
})

const q = Queue<string>("q1", {
	onDequeue: i => console.log(i)
}).start()
```

### Endpoints

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

### CLI commands

```bash
npm i -g node-smart-queues-cli
```

Allows to control queues both locally or remotely via the command line (default address is *0.0.0.0:80*). It requires the HTTP interface to be up and running.

```bash
nsqcli <address>
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
	ignored <queue-name> <key-name>
 STATE - gets the number of pending jobs in a queue for every key (or for a specific key)
	state <queue-name> <key-name> [optional]
 MODE - gets the queue mode (FIFO/LIFO) for the queue key or for a specific key
	mode <queue-name> <key-name> [optional]
 ENQUEUE - push an item to a queue with a key
	push <queue-name> <key-name> <item-content> <item-type> [json/string/number (default: string)]
 EXIT - exit the cli
	exit
```

<br>
<p align="center" width="100%">
  <img src="./images/logo_size.jpg" width="100%" />
</p>
