# Node Smart Queues

## Install

```bash
npm install node-smart-queues
```

## Features

- Stateful
- Crash safe (revovery)
- Jobs keys
- Delayed jobs
- Concurrent queues
- Priorities
- Randomizable
- FIFO / LIFO 
- Queues pool
- Fluent interface
- Typescript first

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