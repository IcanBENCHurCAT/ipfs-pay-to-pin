# v0007: OCI Container Instances & Serverless Autoscaling Architecture

This document details the architectural decisions made during the implementation of the OCI Containers Scalability feature (`specs/010-oci-containers-scalability`).

---

## Status
Approved / Implemented

## Context & Problem
Migrating from fixed Virtual Machines to a serverless container architecture in Oracle Cloud Infrastructure (OCI) to achieve zero-downtime, automated 0-to-N scaling based on incoming API traffic while eliminating host OS maintenance overhead.

## Decision
1. **Serverless OCI Container Instances**: Replaced VM-based hosting with `oci_container_instances_container_instance` using the Always-Free `CI.Standard.A1.Flex` shape (ARM64 Ampere Altra).
2. **Multi-Architecture CI/CD Pipeline**: Configured GitHub Actions (`.github/workflows/deploy.yml`) with QEMU and Docker Buildx to generate multi-architecture image manifests (`linux/amd64`, `linux/arm64`) pushed directly to OCI Container Registry (`iad.ocir.io`).
3. **OCI Flexible Load Balancer**: Deployed an OCI Flexible Load Balancer (`pay-to-pin-load-balancer`) configured with an HTTP `/health` check on port 4021 and port 80 listener.
4. **Sidecar Dynamic DNS Updater**: Integrated an `alpine:latest` sidecar container within the container instance running a continuous heartbeat to DuckDNS (`pay-to-pin.duckdns.org`), explicitly updating the A record to the Load Balancer public IP.
5. **OCI Monitoring & Alarm Policy**: Configured OCI Monitoring alarms (`container_scale_out_alarm` and `container_scale_in_alarm`) for metric-driven traffic notifications and automated pool scaling.

## Consequences
- **Positive**: Serverless zero-to-N auto-scaling eliminates idle VM compute charges while guaranteeing high-availability response times.
- **Positive**: Multi-arch CI/CD build pipeline allows seamless deployment across ARM and AMD OCI hardware shapes.
- **Negative**: Container Instance startup time requires ~1 minute for cold boots, handled gracefully by OCI Load Balancer backend health check retries.

## Superseded Decisions
- Partially supersedes ADR 0005 (VM / Docker Compose deployment replaced by serverless OCI Container Instances & Flexible Load Balancer).
