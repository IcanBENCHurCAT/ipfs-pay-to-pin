# Research & Technical Decisions: OCI Monitoring & Alerting

## Overview
This document captures architectural research and design decisions for provisioning a production-grade OCI Monitoring and Alerting infrastructure using Terraform.

---

## Technical Decisions

### 1. ONS Notification Topic & Email Subscription
- **Decision**: Provision an OCI Notification Service (ONS) Topic (`oci_ons_notification_topic`) named `pay-to-pin-critical-alerts` and subscribe `garretparker@gmail.com` via `oci_ons_subscription`.
- **Rationale**: ONS provides a resilient, serverless event router in OCI. Using `protocol = "EMAIL"` triggers an automatic confirmation flow and delivers structured email alerts without requiring external SMTP relays.
- **Alternatives Considered**:
  - Direct PagerDuty / Webhook integration: Rejected for v1 as email was explicitly requested by user; topic can have additional webhooks attached later without breaking changes.

### 2. Monitoring Query Language (MQL) & Alarm Thresholds
- **Decision**: Implement 5 distinct `oci_monitoring_alarm` resources with 85% thresholds evaluated over 1-minute windows and a 5-minute pending duration (`PT5M`).
  - `CpuUtilization[1m]{resourceId = "<VM_OCID>"}.mean() > 85`
  - `MemoryUtilization[1m]{resourceId = "<VM_OCID>"}.mean() > 85`
  - `DiskUtilization[1m]{resourceId = "<VM_OCID>"}.mean() > 85`
  - `instance_status[1m]{resourceId = "<VM_OCID>"}.mean() != 1`
  - `http_status[1m]{monitorId = "<MONITOR_OCID>"}.mean() != 1`
- **Rationale**: 5-minute sustained window prevents transient spikes from creating notification noise while guaranteeing critical alerts are delivered promptly.
- **Alternatives Considered**:
  - 1-minute instantaneous triggers: High risk of false positives during container startup or temporary heavy load.

### 3. Synthetic HTTP Health Probing
- **Decision**: Provision an `oci_health_checks_http_monitor` probing `https://${var.duckdns_subdomain}.duckdns.org/health` over port 443 at 60-second intervals.
- **Rationale**: Validates the public Let's Encrypt SSL certificate, DuckDNS resolution, firewalls (OCI Security List + IPTables), Docker container runtime, and application routing end-to-end.
- **Alternatives Considered**:
  - ICMP / Ping probe: Does not verify HTTPS stack, Caddy reverse proxy, or Node.js process health.

### 4. Git Hygiene & Sensitive Variable Isolation
- **Decision**: Parameterize email and environment settings in `variables.tf`, default email to `garretparker@gmail.com`, and enforce `.gitignore` rules for `*.tfvars`, `*.tfstate`, and `.terraform/`.
- **Rationale**: Protects secrets and prevents accidental commit of local state files or credentials.
