---
name: oci-alert-runbook
description: Living document and automated operational runbook for responding to OCI infrastructure alarms (CPU, Memory, Disk, Host Health, and HTTP Gateway Downtime) for the IPFS Pay-to-Pin Gateway. Use when responding to alerts, troubleshooting gateway downtime, diagnosing high resource usage, executing recovery procedures, or updating operational alert thresholds.
---

# OCI Alerting & Incident Response Runbook

This skill serves as the **living operational runbook** for the IPFS Pay-to-Pin Gateway infrastructure on Oracle Cloud Infrastructure (OCI). It outlines exact diagnostic procedures, commands, and remediation steps for agents and cloud engineers responding to alerts.

---

## 1. System Architecture Quick Reference

```
                             +-----------------------------------+
                             |       user-email@example.com      |
                             +-----------------+-----------------+
                                               ^
                                    Email      | Notification
                                               |
                             +-----------------+-----------------+
                             |    OCI ONS Notification Topic     |
                             |  "pay-to-pin-critical-alerts"     |
                             +-----------------+-----------------+
                                               ^
                                               | Triggered Alarm
                                               |
      +----------------------------------------+----------------------------------------+
      |                                        |                                        |
      v                                        v                                        v
+-------------------+                +-------------------+                +-------------------+
|  OCI Compute Agent|                | OCI Host Health   |                | OCI Health Checks |
|  (CPU/RAM/Disk)   |                | (Hardware/Kernel) |                | (HTTPS Probe 60s) |
+---------+---------+                +---------+---------+                +---------+---------+
          |                                    |                                    |
          +------------------------------------+------------------------------------+
                                               |
                                               v
                             +-----------------+-----------------+
                             |    OCI Pay-to-Pin Gateway VM      |
                             |   (150.230.165.53 / Ashburn AD1)  |
                             |  - Docker: Caddy (SSL 443)      |
                             |  - Docker: Hono App (Port 4021) |
                             |  - Supabase Postgres DB           |
                             |  - Pinata IPFS Storage           |
                             +-----------------------------------+
```

---

## 2. Alert Triaging Matrix

| Alarm Display Name | Metric / Trigger Condition | Severity | SLA | Primary Section |
|---|---|---|---|---|
| `pay-to-pin-http-gateway-downtime` | HTTPS Probe failed or non-200 on `/health` | **CRITICAL** | < 5 mins | [Section 3.1](#31-runbook-pay-to-pin-http-gateway-downtime-gateway-down) |
| `pay-to-pin-instance-health-degraded` | Host Infrastructure status != 1 | **CRITICAL** | < 5 mins | [Section 3.2](#32-runbook-pay-to-pin-instance-health-degraded-host-failure) |
| `pay-to-pin-cpu-utilization-high` | CPU > 85% for 5 consecutive minutes | **CRITICAL** | < 15 mins | [Section 3.3](#33-runbook-pay-to-pin-cpu-utilization-high-cpu-spike) |
| `pay-to-pin-memory-utilization-high` | RAM > 85% for 5 consecutive minutes | **CRITICAL** | < 15 mins | [Section 3.4](#34-runbook-pay-to-pin-memory-utilization-high-memory-leak) |
| `pay-to-pin-disk-utilization-high` | Root Disk > 85% for 5 consecutive minutes | **CRITICAL** | < 15 mins | [Section 3.5](#35-runbook-pay-to-pin-disk-utilization-high-disk-space-exhaustion) |

---

## 3. Incident Response Runbooks

### 3.1 Runbook: `pay-to-pin-http-gateway-downtime` (Gateway Down)

> **Trigger**: OCI Health Check monitor failed to reach `https://pay-to-pin.duckdns.org/health` or received a HTTP status code other than 200.

#### Step 1: External Probe Verification
Run a manual curl from an external terminal to determine the exact failure code:

```bash
curl -Iv https://pay-to-pin.duckdns.org/health
```

- **DNS Failure**: If `Could not resolve host` -> Proceed to [Step 6 (DuckDNS Verification)](#step-6-duckdns--ssl-cert-verification).
- **Connection Refused / Timeout**: Port 443 closed or VM down -> Proceed to [Step 2 (SSH & Container Status)](#step-2-inspect-docker-containers).
- **HTTP 502 Bad Gateway / 503 Service Unavailable**: Caddy is running but Node.js app is unresponsive -> Proceed to [Step 3 (App Logs)](#step-3-inspect-app-logs).

#### Step 2: Inspect Docker Containers
SSH into the gateway host and check container health:

```bash
ssh -i ~/.oci/oci_api_key.pem ubuntu@150.230.165.53
docker ps -a
```

Verify `ipfs-pay-to-pin-app-1` and `ipfs-pay-to-pin-caddy-1` show status `Up`.

#### Step 3: Inspect App Logs
Check application runtime errors:

```bash
docker logs --tail 100 ipfs-pay-to-pin-app-1
```

Look for:
- Database connectivity failures (`Supabase connection error`).
- Unhandled Promise Rejections.
- Circuit breaker trips (`503 Service Unavailable` returned due to buffer queue saturation).

#### Step 4: Test Local Gateway Endpoint
Bypass Caddy and hit the Node.js process directly:

```bash
curl -i http://localhost:4021/health
```

If local endpoint returns `{"status":"ok"}`: issue lies within Caddy reverse proxy or IPTables firewall.

#### Step 5: Execute Container Restart
If app is frozen or deadlocked, restart container services:

```bash
cd /opt/ipfs-pay-to-pin
docker compose restart
```

#### Step 6: DuckDNS & SSL Cert Verification
If domain resolution or SSL handshakes fail:

```bash
# Verify IP matches DuckDNS record
dig +short pay-to-pin.duckdns.org

# Force update DuckDNS IP if record drifted
curl "https://www.duckdns.org/update?domains=pay-to-pin&token=9eacaaae-1019-4506-a956-8d9b01c29d78&ip=150.230.165.53"
```

---

### 3.2 Runbook: `pay-to-pin-instance-health-degraded` (Host Failure)

> **Trigger**: OCI hypervisor reports compute hardware, underlying host node, or hypervisor failure.

#### Step 1: Query Instance Status via OCI CLI
Check instance state from local machine:

```bash
oci compute instance get \
  --instance-id ocid1.instance.oc1.iad.anuwcljteyy7bsqcxhr2phqmmzy2upewyhdxxgv6exfjojzkpjh73seyrsla
```

#### Step 2: Trigger Instance Soft Reset
Reboot the instance cleanly to migrate hypervisor hosts if necessary:

```bash
oci compute instance action \
  --action SOFTRESET \
  --instance-id ocid1.instance.oc1.iad.anuwcljteyy7bsqcxhr2phqmmzy2upewyhdxxgv6exfjojzkpjh73seyrsla
```

If soft reset hangs for > 3 minutes, force a hard reset:

```bash
oci compute instance action \
  --action HARDRESET \
  --instance-id ocid1.instance.oc1.iad.anuwcljteyy7bsqcxhr2phqmmzy2upewyhdxxgv6exfjojzkpjh73seyrsla
```

#### Step 3: Post-Boot Verification
Once instance transitions back to `RUNNING`:

```bash
ssh -i ~/.oci/oci_api_key.pem ubuntu@150.230.165.53 "docker ps && curl -s http://localhost:4021/health"
```

---

### 3.3 Runbook: `pay-to-pin-cpu-utilization-high` (CPU Spike)

> **Trigger**: Sustained CPU load > 85% for 5 minutes.

#### Step 1: Identify Process Consuming CPU
SSH into instance and run process inspection:

```bash
top -b -n 1 | head -n 20
docker stats --no-stream
```

#### Step 2: Analyze Node.js Event Loop / Async Queue
Check if background worker orPinata upload retries are spinning:

```bash
docker logs --tail 200 ipfs-pay-to-pin-app-1 | grep -i "error\|retry\|pinning"
```

#### Step 3: Gracefully Restart App Container
Release CPU contention by restarting the application worker:

```bash
cd /opt/ipfs-pay-to-pin && docker compose restart app
```

---

### 3.4 Runbook: `pay-to-pin-memory-utilization-high` (Memory Leak)

> **Trigger**: RAM utilization > 85% for 5 minutes.

#### Step 1: Memory Footprint Inspection
Check container memory allocation:

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
free -h
```

#### Step 2: Check Local Buffer Queue Saturation
Verify if heavy Base64 payload buffers are accumulating in memory:

```bash
# Query Supabase pin status count
curl -s "https://gtcguonqciokigxlvfyq.supabase.co/rest/v1/pins?select=status&status=eq.pending" \
  -H "apikey: ${SUPABASE_KEY}"
```

#### Step 3: Restart Container to Clear Heap
If Node.js process heap memory is bloated:

```bash
docker compose restart app
```

---

### 3.5 Runbook: `pay-to-pin-disk-utilization-high` (Disk Space Exhaustion)

> **Trigger**: Root partition disk utilization > 85% for 5 minutes.

#### Step 1: Check File System Usage
SSH into server and locate largest directories:

```bash
df -h /
du -sh /var/lib/docker /var/log /opt/ipfs-pay-to-pin /tmp
```

#### Step 2: Execute Docker System Cleanup
Prune dangling containers, unused images, and volume caches:

```bash
docker system prune -af --volumes
```

#### Step 3: Vacuum Log Files
Truncate accumulated systemd and container logs:

```bash
journalctl --vacuum-size=200M
sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

---

## 4. Verification & Testing Tools

### Simulate CPU Alarm (Testing)
To test alarm dispatch without damaging system:

```bash
# Install stress utility on VM
sudo apt-get install -y stress
# Run 100% CPU load across 2 cores for 6 minutes
stress --cpu 2 --timeout 360s
```

Verify receipt of email alert at `user-email@example.com` after 5 minutes.

---

## 5. Living Document Governance & Maintenance

- **Updating Thresholds**: When modifying alarm thresholds in `terraform/monitoring.tf`, update the [Alert Triaging Matrix](#2-alert-triaging-matrix) in this document in the same PR.
- **Post-Mortem Logging**: Following any `CRITICAL` incident, append a brief entry to `docs/incidents.md` documenting root cause, resolution duration, and runbook updates.
