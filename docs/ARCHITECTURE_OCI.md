# Shared OCI Always-Free Infrastructure Architecture

This document describes the unified multi-app deployment architecture for **InkPanel** (`inkpanel.duckdns.org`) and **IPFS Pay-to-Pin Gateway** (`pay-to-pin.duckdns.org`) on Oracle Cloud Infrastructure (OCI) Always-Free tier.

---

## 1. Architectural Principles

1. **Shared Resource Pool, Isolated Execution**: Both applications share the tenancy's Always-Free capacity without competing unbounded or sharing file systems.
2. **Automated Continuous Delivery**: Merges to `main` automatically build, test, and deploy without human approval gates.
3. **Defense in Depth**:
   - Least privilege networking: Only ports 80/443 (Edge) and 22 (SSH deploy) are open to the internet. Internal application ports (`8000` for InkPanel, `4021` for Pay-to-Pin) are only accessible within the internal VCN subnet.
   - Per-app Docker bridge networks prevent inter-container discovery.
   - Dedicated service user (`deployer`) with sudo rights restricted exclusively to Docker Compose.
4. **Resilience & Self-Healing**: Automated post-deploy health checks with instantaneous rollback to the previous working image if a failure is detected.

---

## 2. Infrastructure Diagram

```mermaid
graph TD
    Client["Clients & Authors"] -->|HTTPS :443 / HTTP :80| EdgeCaddy["Edge Gateway (Caddy)"]

    subgraph OCI VCN: pay-to-pin-vcn [10.0.0.0/16]
        subgraph Subnet: edge-subnet [10.0.3.0/24]
            EdgeCaddy["Caddy Edge Reverse Proxy<br/>Auto Let's Encrypt TLS<br/>Ports 80, 443"]
        end

        subgraph Subnet: apps-subnet [10.0.4.0/24]
            subgraph InkPanel Stack [/opt/inkpanel]
                InkPanel["InkPanel Container<br/>FastAPI (:8000)<br/>Limits: 1.5 CPU, 8GB RAM"]
                InkPanelVol[("Named Volume: inkpanel_data<br/>/app/data (SQLite)")]
                InkPanelNet["Bridge: inkpanel_net"]
            end

            subgraph Pay-to-Pin Stack [/opt/ipfs-pay-to-pin]
                PayToPin["Pay-to-Pin Gateway<br/>Express (:4021)<br/>Limits: 0.8 CPU, 3GB RAM"]
                PayToPinVol[("Named Volume: queue_data<br/>/app/queue")]
                PayToPinNet["Bridge: paytopin_net"]
            end
        end
    end

    EdgeCaddy -->|Reverse Proxy :8000| InkPanel
    EdgeCaddy -->|Reverse Proxy :4021| PayToPin
    InkPanel --- InkPanelVol
    InkPanel --- InkPanelNet
    PayToPin --- PayToPinVol
    PayToPin --- PayToPinNet

    GH["GitHub Actions Runner (push to main)"] -->|1. Build & Push| GHCR["GitHub Container Registry (ghcr.io)"]
    GH -->|2. SSH Deploy & Probe| apps-subnet
```

---

## 3. Compartment & Tagging Model

* **Compartment**: `production-apps` (`ocid1.compartment.oc1..aaaaaaaajs6nvfpie7q6vqgokutusjbj4lip4cnvd7fvtxmer3sgflg44zvq`).
* **Design Justification**:
  * Cross-compartment VCN peering and subnet routing in OCI adds unnecessary policy overhead and complex IAM statement proliferation.
  * A single unified compartment with strict freeform tags (`Project: inkpanel`, `Project: pay-to-pin`, `Role: edge-proxy`, `Role: docker-apps`) allows:
    1. Single, clean security list management.
    2. Zero risk of cross-compartment quota fragmentation under OCI Always Free limits.
    3. Scoped least-privilege policies for `ci-deployer`.

---

## 4. Compute & Resource Limits

| Component | Host / Runtime | CPU Allocation | Memory Limit | Storage |
|---|---|---|---|---|
| **Edge Gateway** | Caddy container | 0.5 OCPU | 1 GB | Shared root |
| **InkPanel** | Python 3.11 / FastAPI | 1.5 OCPU | 8 GB | Persistent volume `inkpanel_data` |
| **IPFS Pay-to-Pin** | Node.js 20 Alpine | 0.8 OCPU | 3 GB | Persistent volume `queue_data` |
| **Tenancy Headroom** | Always-Free Pool | Reserved for OS and buffer | Reserved | Total boot <= 100 GB |

---

## 5. Security & Network Firewall Rules

1. **Edge Subnet (`10.0.3.0/24`)**:
   * `80/tcp` (HTTP) from `0.0.0.0/0` (ACME challenges and redirect).
   * `443/tcp` (HTTPS) from `0.0.0.0/0` (Secure traffic).
   * `22/tcp` (SSH) from `0.0.0.0/0` (Admin access).
2. **Apps Subnet (`10.0.4.0/24`)**:
   * `22/tcp` (SSH) from `0.0.0.0/0` (Restricted `deployer` key access from GitHub Actions).
   * `8000/tcp` (InkPanel) from `10.0.3.0/24` ONLY (traffic rejected from any outside source).
   * `4021/tcp` (Pay-to-Pin) from `10.0.3.0/24` ONLY (traffic rejected from any outside source).
3. **Application Layer**:
   * `inkpanel_net` and `paytopin_net` are independent Docker bridge networks. Inter-app packet exchange is blocked by Docker firewall rules.

---

## 6. Remote State & Object Storage

* **Bucket**: `terraform-remote-state` in namespace `id1fbfmorrpo`.
* **Access**: Pre-Authenticated Request (PAR) read/write endpoints with TLS 1.3 encryption and object versioning enabled.
* **Isolation**: Separate object keys (`inkpanel.tfstate` and `pay-to-pin.tfstate`) prevent cross-project state corruption.
