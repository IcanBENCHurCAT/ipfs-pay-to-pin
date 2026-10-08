# Continuous Delivery, Rollback & Emergency-Pause Runbook

This runbook documents the operational procedures for managing automated continuous deployments, rollbacks, and emergency killswitches for **InkPanel** and **IPFS Pay-to-Pin**.

---

## 1. Automated Deployment Pipeline

Both repositories execute automated deployments on every `push` to branch `main`. No manual approval gates exist in the execution path.

### Safety Rails Architecture
1. **Pre-flight CI Gate**: Unit and integration test suites run first (`ci-test`). A single failure terminates the run immediately with zero production mutation.
2. **Atomic Tag Pinning**: Deployments pin to immutable git commit SHA image tags (`sha-<7char>`). The `:latest` tag is updated concurrently for reference but never relied upon for atomic rollback.
3. **Active Health Probe**: Upon container restart, the runner probes the application health endpoint every 3 seconds for up to 45 seconds.
4. **Autonomous Rollback**: If the health probe fails, the runner immediately reverts the container to the previous working image and alerts the team.

---

## 2. Emergency-Pause Procedures (Fast Killswitch)

If an active production issue is detected and you need to stop all inbound CI/CD deployments instantly:

### Method A: GitHub Actions Fast Pause (Recommended)
Disable the deployment workflow via GitHub CLI or web UI:

```bash
# Pause InkPanel deployments
gh workflow disable deploy.yml --repo IcanBENCHurCAT/inkpanel

# Pause Pay-to-Pin deployments
gh workflow disable deploy.yml --repo IcanBENCHurCAT/ipfs-pay-to-pin
```

To re-enable deployments after resolution:
```bash
gh workflow enable deploy.yml --repo IcanBENCHurCAT/inkpanel
gh workflow enable deploy.yml --repo IcanBENCHurCAT/ipfs-pay-to-pin
```

### Method B: Host-Level Killswitch File
On the target deployment host, create an emergency pause sentinel:

```bash
# Connect to host
ssh deployer@<DEPLOY_HOST>

# InkPanel pause flag
touch /opt/inkpanel/.deploy-pause

# Pay-to-Pin pause flag
touch /opt/ipfs-pay-to-pin/.deploy-pause
```

The GitHub Actions runner inspects this path prior to executing `docker compose pull`. If present, the runner aborts with code 1 and logs an advisory notice.

---

## 3. Manual Rollback Procedures

If an edge-case bug passes synthetic health checks but requires rolling back to a known-good commit:

### Step-by-Step Manual Rollback

1. **Identify Previous Working Image**:
   List available image tags in GHCR:
   ```bash
   gh api /orgs/IcanBENCHurCAT/packages/container/inkpanel/versions --jq '.[].metadata.container.tags'
   ```

2. **Execute Rollback on Host**:
   ```bash
   ssh deployer@<DEPLOY_HOST>
   
   # For InkPanel:
   cd /opt/inkpanel
   sed -i 's/IMAGE_TAG=.*/IMAGE_TAG=sha-<TARGET_SHA>/' .env
   docker compose pull
   docker compose up -d
   
   # Verify health:
   curl -fsS http://localhost:8000/api/health
   ```

3. **Verify Public Endpoint**:
   ```bash
   curl -I https://inkpanel.duckdns.org/api/health
   curl -I https://pay-to-pin.duckdns.org/health
   ```

---

## 4. Deploy Notifications

On every deploy run (success, failure, or rollback), the runner outputs:
1. **GitHub Job Summary**: Rendered markdown report detailing commit SHA, author, elapsed duration, health status, and active rollback status.
2. **OCI Notification Topic**: Critical status broadcast to `pay-to-pin-critical-alerts` topic sending automated email alert to `garretparker@gmail.com`.
