# Phase 1: Data Model (AB-PP-001)

## Contract State Layout

The pricing contract uses Global State to store the configuration.

| Variable | Type | Description |
|----------|------|-------------|
| `owner` | `Address` | The account authorized to update pricing. |
| `base_price` | `uint64` | The flat fee component of the service in microALGOs. |
| `byte_price` | `uint64` | The per-byte fee component of the service in microALGOs. |
