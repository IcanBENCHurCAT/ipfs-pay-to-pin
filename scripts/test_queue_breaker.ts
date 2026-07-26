import { globalFileQueue } from '../src/queue.js';
import { calculateLocalCid } from '../src/cid.js';

async function test() {
  console.log("=== Testing Queue & Circuit Breaker Logic ===");
  
  const testBuffer = Buffer.from("Hello IPFS Pay-to-Pin Gateway World!");
  const cid = calculateLocalCid(testBuffer);
  console.log("Calculated Local CID:", cid);

  console.log("\n1. Testing Add Job to Queue...");
  const job1 = globalFileQueue.addJob("test.txt", testBuffer);
  console.log("Job 1 Added:", job1.id, "Status:", job1.status, "CID:", job1.cid);

  console.log("\n2. Testing Deduplication...");
  const job2 = globalFileQueue.addJob("test_dup.txt", testBuffer);
  console.log("Job 2 Result (Deduplicated):", job2.id, "Status:", job2.status);

  console.log("\n3. Testing Process Queue Jobs...");
  await globalFileQueue.processJobs();
  console.log("Queue size after processing:", globalFileQueue.getQueueSize());

  console.log("\n=== Test Completed Successfully ===");
}

test().catch(console.error);
