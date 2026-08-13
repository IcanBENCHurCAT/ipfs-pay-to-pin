# Implementation Plan: Migrate from VMs to OCI Containers with Auto-scaling

**Branch**: `010-oci-containers-scalability` | **Date**: 2026-08-12 | **Spec**: [spec.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/010-oci-containers-scalability/spec.md)

## Summary

Migrate the backend gateway infrastructure from static Terraform VMs to OCI Container Instances (Serverless) for 0-to-N auto-scaling. The new infrastructure will scale based on incoming HTTP traffic and scale to exactly 0 to eliminate costs during idle periods. Additionally, a CI/CD pipeline via GitHub Actions using Workload Identity Federation (WLIF) will be configured to build and deploy containers securely.

## Technical Context

**Language/Version**: HCL (Terraform) and TypeScript / Node.js (Gateway app)

**Primary Dependencies**: OCI Terraform Provider, Hono, @x402/hono

**Storage**: Supabase PostgreSQL (state persistence), OCI File Storage (for shared container volume)

**Testing**: `terraform plan` / `terraform validate`

**Target Platform**: Oracle Cloud Infrastructure (OCI) Container Instances

**Project Type**: Infrastructure as Code (IaC) & Web Service

**Performance Goals**: <10s cold start from 0 to 1 instance.

**Constraints**: Local filesystem state (`queue/registry.json`) must survive container restarts. We will mount an OCI File Storage (FSS) volume to the containers to ensure the queue registry is atomic and highly available across instances.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Smart Contract Language**: N/A for this infrastructure change.
- [x] **RekeyTo Protection**: N/A
- [x] **Owner-only Configuration**: N/A
- [x] **HTTP x402 Protocol Compliance**: The deployed API will continue to use standard HTTP 402 with `@x402/hono`.
- [x] **IPFS Pinning Integration**: IPFS workflows remain intact.
- [x] **Atomic Persistence (I.5.3)**: Shared volume storage (FSS) ensures atomic file operations function correctly across instances.
- [x] **Production Packaging (I.6.1)**: Container will use multi-stage Docker builds.

## Project Structure

### Documentation (this feature)

```text
specs/010-oci-containers-scalability/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (to be created by /speckit-tasks)
```

### Source Code (repository root)

```text
terraform/
├── main.tf
├── variables.tf
├── outputs.tf
├── container_instances.tf
├── autoscaling.tf
└── identity.tf          # WLIF configuration for GitHub Actions

.github/
└── workflows/
    └── deploy.yml       # GitHub Actions CI/CD pipeline

src/
├── index.ts
└── db.ts
```

**Structure Decision**: Infrastructure as Code will reside in the `terraform/` directory, expanding the existing templates to support OCI Container Instances, Autoscaling configurations, and WLIF identity setup. The CI/CD pipeline will be managed in `.github/workflows/deploy.yml`.
