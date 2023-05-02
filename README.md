<p align="center" width="100%">
	<br>
  <img src="./images/logo_size_invert.jpg" width="100%" />
  <br>
  <br>
		<p align="center">A stateful queue system for Node.js<br>that focuses on <b>versatility</b>, <b>control</b> and <b>ease of use</b><p>
  </p>
	<br>
		<div width="100%" align="center">Features:</div>
		<div width="100%" align="center"><b>Crash safe (automatic recovery)</b></div>
		<div width="100%" align="center"><b>Stateful (Redis, file system)</b></div>
		<div width="100%" align="center"><b>Concurrent queues</b></div>
		<div width="100%" align="center"><b>Tasks keys based</b></div>
		<div width="100%" align="center"><b>Timed dequeue</b></div>
		<div width="100%" align="center"><b>Typescript first</b></div>
		<div width="100%" align="center"><b>HTTP interface</b></div>
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
- [State Management](#state-management)
	- [In-memory Storage](#in-memory-storage)
	- [Redis Storage](#redis-storage)
- [Queue options](#queue-options)
- [Queue methods](#queue-methods)
	- [Enqueue](#enqueue)
	- [Flow control](#flow-control)
	- [Keys status](#keys-status)
		- [Ignore/Restore](#ignorerestore)
		- [Block/Release](#blockrelease)
	- [Miscellaneous](#miscellaneous)
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

## State Management

### In-memory storage

Smart Queues use an in-memory storage system by default (not crash safe), but you can change this setting by using a different storage system. When using a safe storage system, the queue will automatically recover the hanging state as soon as the program gets restarted. 

### Redis Storage

Will use Redis' [sorted sets](https://redis.io/docs/data-types/sorted-sets/) as storage system. [ioredis](https://github.com/luin/ioredis) options must be provideded. If you think that the items pushed to the queue may be bigger than 512MB (maximum Redis record size), consider using the compression (gzip) shipped with the queue system.

```typescript
import { Queue, redisStorage } from "node-smart-queues"

const queue = Queue<number>("my-queue", {
	storage: redisStorage({ host: "localhost", port: 6379, TTLms: 10000 }), //TTL is optional
	gzip: true,
	dequeueInterval: 1000,
	onDequeue: i => console.log(i))
}).start();
```

> **Why sorted sets?** that's because Redis' lists (which would a have been a better choiche, from a performace point of view) lacks a proper TTL system. To provide this feature (and to mantain the storage recovery compatibility when dynamically adding or removing the TTL), I prefered to take advantage of Redis' sorted sets, using the enqueue timestamp as score, which is automatically checked for cleanups when a TTL is provided. This mean that the enqueing and dequeing time complexity will be **O(log n)** instead of **O(1)**, which shouldn't be a big performance loss in a queue context, unless items are supposed to stay enqueued for a long time and a lot of items get enqueued. However, if you really need O(1) performance a spceific redis list storage system is available:

```typescript
storage: redisListStorage({ host: "localhost", port: 6379 }) // TTL not available
```

> use this if
>
>	- you absolutely need O(1) performance
>	- you don't need to set a TTL
>	- you don't plan to add a TTL or, if you do, you don't mind losing stored data when setting restarting the queue with the norma redisStorage

## Queue options

Queue options can be of two types:

- **Global**: valid for all job keys (overidden by single key-specific options)
- **Key-specific**: valid for a single key (override the correspondant global property)

Here's an overview of all the available queue options:

```typescript
// global options
const q1 = new Queue<number>("q1", { 
	storage: redisStorage({ host: "localhost", port: 6379 }), //default memory
	logger: true, //toggle the logger (defalut true)
	gzip: true, //toggle gzip compression (default false)
	dequeueSize: 2, //set nuber of item per dequeue (default 1)
	onDequeue: async (i, k, q) => console.log("success:", i, k, q),
	onDequeueAwaited: false, //default true
	priority: ["k2", "k3", "k4"], //higher to lower
	ignore: ["k5"],
	ignoreNotPrioritized: true, //default false
	randomPriority: false, //default false
	ignoreItemCondition: i => i >= 12,
	dequeueInterval: 2000, //run a dequeue every 2secs (default 0)
	maxRetry: 5, //max onDequeue attempts (default 1 - no errors allowed)
	onMaxRetry: async (err, i, k, q) => console.log("error:", err, i, k, q), //if last retry errored
	onMaxRetryAwaited: true, //default true
	mode: "LIFO", //default FIFO
})

//key-specific options
q1.key("k1", {
	dequeueSize: 2,
	onDequeue: async (i, k, q) => console.log("success k2:", i, k, q),
	onDequeueAwaited: false,
	ignoreItemCondition: i => i <= 3,
	dequeueInterval: 5000,
	maxRetry: 1,
	onMaxRetry: async (err, i, k, q) => console.log("error k2:", err, i, k, q),
	onMaxRetryAwaited: false,
	mode: "FIFO",
})
```

## Queue methods

Here's an overview of all the available queue methods:

### Enqueue

```typescript
//(async) push an item to the queue 
queue.enqueue("my-key", 3, { throwErrors: false /*default true*/}) 
/* returns: {
	enqueued: boolean (tells if the item was acutally enqueued)
	message: string (tells why an item wasn't actually enqueued)
	error?: Error (js error object if throwErrors option is false)
	code: number (enqueue result code) 
		0 = item enqueued
		1 = key is ignored
		2 = key not prioritized (only with ignoreNotPrioritized option)
		3 = missing condition (only with ignoreItemCondition option)
		4 = an error occurred

		note: case 1,2 and 3 won't cause an error
} */
```

### Flow control

Pause method stops items dequeing but keeps item enqueing. See [block](#blockrelease) method for a key-specific pausing.

```typescript
//pause the queue until the start command is triggered
queue.pause() 

//pause the queue for 5000ms (or until a start command)
queue.pause(5000) 

//true/false
queue.isPaused() 

queue.start()
```

### Key status

#### Ignore/Restore

Affects items enqueing only

```typescript
//stops enqueing provided keys' items
queue.ignoreKeys("key-1", "key-2" /*....*/) 

//restarts enqueing provided keys' items
queue.restoreKeys("key-1", "key-2" /*....*/) 

//true/false
queue.isKeyIgnored("key-1")
```

#### Block/Release

Affects items dequeing only (acts as a key-specific queue [pause](#flow-control))

```typescript
//stops equeing provided keys' items
queue.blockKeys("key-1", "key-2" /*....*/) 

//restart dequeing provided keys' itens
queue.releaseKeys("key-1", "key-2" /*....*/) 

//true/false
queue.isKeyBlocked("key-1")
```

### Miscellaneous

```typescript
//returns the queue name
queue.getName() 

//ovverride options after queue creation
queue.options({/*..global options..*/}) 

//tells if the mode is FIFO/LIFO (global)
queue.getDequeueMode() 

//tells if the mode is FIFO/LIFO (key specific)
queue.getDequeueMode("key-1")

//(async) returns the number of stored items for every known key
queue.getStorageCount() 
/*returns: {
	"key-1": 12,
	"key-2": 34,
	..etc..
}*/
```


## HTTP / CLI interface

To interact with all the queues in the pool via the built-in HTTP/CLI interface, you have to import the server builder and pass the QueuePool object to it, along with some options. It will automatically setup a [fastify](https://github.com/fastify/fastify) server that exposes some useful endpoints. It will also allow to control the queues via the **nsqcli**.

```bash
npm i node-smart-queues-http
```

```typescript
import { QueuesPool, Queue } from "node-smart-queues"
import { nsqServer } from "node-smart-queues-http"

await nsqServer(QueuesPool, {
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

> **Note**: the **nsqcli** can be installed as a standalone application on a different machine to remotely control the queues

```bash
npm i -g node-smart-queues-cli
```

Allows to control queues both locally or remotely via the command line. Use the **NSQ_URL** environment variable to set the server address (default address is *http://0.0.0.0:3000*). It requires the HTTP interface to be up and running.

```bash
nsqcli
```

Type *HELP* in the cli to get the list of all available commands.

```
LIST gets the names of the queues that are registered in the pool
EXISTS tells if a queue exists by name
PAUSE pauses a queue (optional pause timeout in ms)
START starts a queue (or resumes it)
EXIT exit the cli
IGNORE commands a queue to ignore a list of keys (comma separated)
RESTORE commands a queue to restore a list of keys (comma separated)
IGNORED tells if a key is ignored by a queue
PENDING gets the number of pending jobs in a queue for every key (or for a specific key)
MODE gets the queue mode (FIFO/LIFO) for the queue key or for a specific key
ENQUEUE push an item to a queue for a certain key
PAUSED tells if a queue is paused
BLOCK commands a queue to stop dequeuing a list of keys (comma separated)
RELEASE commands a queue to release a list of previously blocked keys (comma separated)
BLOCKED tells if a key is blocked within a queue
```

<br>
<p align="center" width="100%">
  <img src="./images/logo_size.jpg" width="100%" />
</p>

