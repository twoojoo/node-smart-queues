# NSQ - Node Smart Queues

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

This example shows a simple queue where jobs will come out every second (even if they are pushed in the queue in the same moment).

```typescript
const queue = SmartQueue<number>("my-queue")
	.setDelay("*", 1000)
	.onFlush("*", (i, k, q) => console.log(`flushed item ${i} with key ${k} from queue ${q}`))
	.start();

(async function() {
	await queue.push("my-key", 1)
	await queue.push("my-key", 2)
	await queue.push("my-key", 3)
})()
```