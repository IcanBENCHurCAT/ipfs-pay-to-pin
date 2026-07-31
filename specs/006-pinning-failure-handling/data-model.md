# Data Model: Pinning Failure Handling

## Entities

### `UploadJob` (Local Queue Item)
Represents a file payload accepted from the client, awaiting async upload to Pinata.
- `id` (string): Unique job ID (e.g. UUID or hash).
- `filename` (string): Original uploaded filename.
- `filePath` (string): Absolute path to the locally buffered binary on disk.
- `status` (enum): `PENDING`, `PINNED`, `FAILED`.
- `createdAt` (number): Unix timestamp.
- `ipfs_cid` (string): The resolved CID once pinned.

## Validation Rules
- Disk size limit: The total size of all `UploadJob` files on disk must not exceed `MAX_QUEUE_BYTES` (e.g., 1GB).
- Queue count limit: The total number of `PENDING` items must not exceed `MAX_QUEUE_ITEMS` (e.g., 50).

## State Transitions
1. `POST /api/v1/pin` (after payment verification) -> writes payload to disk, creates `UploadJob` in `PENDING` state. Returns 201 Created.
2. Background Worker reads `PENDING` item -> calls `pinFileToStorage`.
3. If successful -> updates status to `PINNED`, deletes local buffered payload from disk.
4. If fails -> leaves status as `PENDING` (to retry later) or sets to `FAILED` if unrecoverable.
