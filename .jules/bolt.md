## 2026-08-03 - [Queue Performance Optimization]
**Learning:** The application queries the Supabase database on every `getItems()` call for every single read or queue operation, overwriting the entire fallback local JSON registry sequentially. In a high-throughput pinning gateway, this is O(N) database operations that block event loop and max out DB connections.
**Action:** Implemented in-memory state fallback. Modifying `getItems()` to return the pre-initialized and correctly-synchronized `itemsCache` instance significantly speeds up operations like `findByCid`, queuing, and circuit breaking checks.

## 2026-08-03 - [Synchronous I/O Blocking]
**Learning:** The application was using synchronous file I/O operations (`fs.writeFileSync`, `fs.readFileSync`) for its fallback local JSON registry, which blocks the Node.js event loop on the main thread and causes significant latency spikes for all concurrent API requests.
**Action:** Replaced synchronous file I/O operations with asynchronous promises (`fs.promises.writeFile`, `fs.promises.readFile`) to prevent blocking the event loop and improve throughput.

## 2026-08-04 - [Synchronous Base64 Length Calculation Blocking]
**Learning:** Performing multiple regex string replacements (`replace(/-/g, '+')`, etc.) on large Base64 strings (up to 20MB payload limit) to calculate the binary byte size for pricing blocks the Node.js event loop synchronously and causes unnecessary high memory allocations.
**Action:** Replaced O(N) string copy/manipulation with an O(1) mathematical calculation using string length and padding inspection (`Math.floor(((len - padding) * 3) / 4)`), completely eliminating the blocking and memory overhead.

## 2026-08-05 - [Synchronous Hashing Memory Allocation]
**Learning:** The application was using `Buffer.concat()` to append multiple chunks (like protobuf headers and payload sizes) to large file payloads (up to 20MB) in order to calculate deterministic IPFS CIDs. This synchronous operation creates a second copy of the entire 20MB buffer in memory all at once, stalling the V8 event loop and increasing GC pressure for large files.
**Action:** Replaced `Buffer.concat()` with sequential streaming `crypto.createHash().update()` calls. We can pass the chunks one by one directly into the hashing stream. This removes the O(N) memory allocation entirely, avoiding event loop blockage and significantly reducing latency for hash computation of large payloads.
## 2026-08-07 - [Avoid Intermediate Array Allocations in Iterations]
**Learning:** Using chained array methods like `.filter().length` or `.filter().reduce()` on large collections inside hot paths (e.g., repeatedly called queue metric functions) creates hidden performance bottlenecks by allocating and garbage collecting intermediate arrays.
**Action:** Replaced functional array methods with manual single-pass `for` loops to count size and sum bytes in O(N) time with O(1) memory overhead, minimizing GC pressure and latency spikes.

## 2026-08-08 - [Synchronous `fs.existsSync` Blocking]
**Learning:** While most synchronous file I/O operations (`readFileSync`, `writeFileSync`) were removed previously, checking file existence using `fs.existsSync` before file reads and directory creation was overlooked. In a high-throughput queue and storage module, doing this repeatedly inside hot paths (like `processJobs` and `unpinFileFromIPFS`) still synchronously blocks the Node.js event loop, causing latency spikes for concurrent API requests.
**Action:** Completely removed `fs.existsSync` usage. Replaced it with try/catch blocks on asynchronous file reads (`fs.promises.readFile`), and unconditional asynchronous directory creations (`fs.promises.mkdir` with recursive: true) with catch blocks to silently handle existing directories.
