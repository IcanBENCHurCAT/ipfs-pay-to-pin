const fs = require('fs');
const path = require('path');

async function unpinFileFromIPFSSequential(cid, storageDir) {
  try {
    const files = await fs.promises.readdir(storageDir);
    for (const file of files) {
      if (file.startsWith(`${cid}_`)) {
        try {
          await fs.promises.unlink(path.join(storageDir, file));
        } catch (e) {
        }
      }
    }
  } catch (e) {
  }
}

async function unpinFileFromIPFSConcurrent(cid, storageDir) {
  try {
    const files = await fs.promises.readdir(storageDir);
    const deletePromises = files
      .filter(file => file.startsWith(`${cid}_`))
      .map(file => fs.promises.unlink(path.join(storageDir, file)).catch(e => {}));

    await Promise.all(deletePromises);
  } catch (e) {
  }
}

async function runBenchmark() {
  const storageDir = path.join(__dirname, 'tmp_bench_storage');

  // Create 1000 files matching
  const cid = 'testcid';

  async function setup() {
    await fs.promises.mkdir(storageDir, { recursive: true }).catch(() => {});
    for (let i = 0; i < 1000; i++) {
      await fs.promises.writeFile(path.join(storageDir, `${cid}_file_${i}.txt`), 'data');
    }
  }

  // Sequential benchmark
  await setup();
  const startSeq = performance.now();
  await unpinFileFromIPFSSequential(cid, storageDir);
  const endSeq = performance.now();
  console.log(`Sequential deletion of 1000 files took: ${(endSeq - startSeq).toFixed(2)} ms`);

  // Concurrent benchmark
  await setup();
  const startCon = performance.now();
  await unpinFileFromIPFSConcurrent(cid, storageDir);
  const endCon = performance.now();
  console.log(`Concurrent deletion of 1000 files took: ${(endCon - startCon).toFixed(2)} ms`);

  await fs.promises.rm(storageDir, { recursive: true, force: true }).catch(()=> { });
}

runBenchmark();
