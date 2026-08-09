# Implementation Plan: OCI Monitoring & Alerting Infrastructure

**Branch**: `008-oci-monitoring-alerting` | **Date**: 2026-08-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-oci-monitoring-alerting/spec.md`

## Summary

Provision an enterprise OCI Monitoring and Alerting infrastructure using Terraform. This solution creates an OCI Notification Service (ONS) topic, registers `garretparker@gmail.com` as an email subscriber, provisions synthetic HTTP health probes for `https://pay-to-pin.duckdns.org/health`, and establishes 5 critical MQL monitoring alarms for CPU, Memory, Disk, Host Infrastructure, and Endpoint Availability.

## Technical Context

**Language/Version**: HCL / Terraform `>= 1.2.0` (OCI Provider `>= 5.0.0`)

**Primary Dependencies**: `oracle/oci` Terraform provider

**Storage**: Local / Remote Terraform State (`.tfstate` ignored in Git)

**Testing**: `terraform validate`, `terraform plan`

**Target Platform**: Oracle Cloud Infrastructure (OCI) Tenancy

**Project Type**: Infrastructure-as-Code (IaC)

**Performance Goals**: Alarm evaluation window of 1 minute, pending duration of 5 minutes (`PT5M`), HTTP health probe interval of 60 seconds.

**Constraints**: Zero hardcoded secrets in Git repository; `terraform.tfvars` added to `.gitignore`.

**Scale/Scope**: Single-compartment compute & gateway monitoring with email notification routing.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Smart Contract Language**: N/A for infrastructure monitoring (Escrow contracts unchanged).
- [x] **RekeyTo Protection**: N/A for infrastructure monitoring.
- [x] **Owner-only Configuration**: OCI compartment permissions manage notification topic and alarm modification rights.
- [x] **HTTP x402 Protocol Compliance**: Unchanged (gateway continues to serve x402 standard headers).
- [x] **IPFS Pinning Integration**: Unchanged (gateway continues Pinata pinning).

## Project Structure

### Documentation (this feature)

```text
specs/008-oci-monitoring-alerting/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Interface contracts
│   └── monitoring-contract.json
└── checklists/          # Requirements checklist
    └── requirements.md
```

### Source Code (repository root)

```text
terraform/
├── main.tf              # OCI Provider & VCN/Compute resources
├── monitoring.tf        # [NEW] ONS Topic, Email Sub, Health Monitor, & 5 Alarms
├── variables.tf         # Input variable definitions (including notification_email)
├── outputs.tf           # Output values (Topic OCID, Subscription status, Alarm names)
├── terraform.tfvars.example # Example variable values
└── .terraform.lock.hcl  # Provider lock file

.gitignore               # [UPDATED] Ignore *.tfvars, *.tfstate, .terraform/
```

**Structure Decision**: Infrastructure code modularized under `terraform/` directory, keeping monitoring resources isolated in `monitoring.tf`.

## Complexity Tracking

*No constitution violations. Zero architectural complexity added.*
