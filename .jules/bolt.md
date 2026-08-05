## 2026-08-03 - [Queue Performance Optimization]
**Learning:** The application queries the Supabase database on every `getItems()` call for every single read or queue operation, overwriting the entire fallback local JSON registry sequentially. In a high-throughput pinning gateway, this is O(N) database operations that block event loop and max out DB connections.
**Action:** Implemented in-memory state fallback. Modifying `getItems()` to return the pre-initialized and correctly-synchronized `itemsCache` instance significantly speeds up operations like `findByCid`, queuing, and circuit breaking checks.

## 2026-08-03 - [Synchronous I/O Blocking]
**Learning:** The application was using synchronous file I/O operations (`fs.writeFileSync`, `fs.readFileSync`) for its fallback local JSON registry, which blocks the Node.js event loop on the main thread and causes significant latency spikes for all concurrent API requests.
**Action:** Replaced synchronous file I/O operations with asynchronous promises (`fs.promises.writeFile`, `fs.promises.readFile`) to prevent blocking the event loop and improve throughput.

## 2026-08-04 - [Synchronous Base64 Length Calculation Blocking]
**Learning:** Performing multiple regex string replacements (`replace(/-/g, '+')`, etc.) on large Base64 strings (up to 20MB payload limit) to calculate the binary byte size for pricing blocks the Node.js event loop synchronously and causes unnecessary high memory allocations.
**Action:** Replaced O(N) string copy/manipulation with an O(1) mathematical calculation using string length and padding inspection (`Math.floor(((len - padding) * 3) / 4)`), completely eliminating the blocking and memory overhead.
