# Tasks: OCI Monitoring & Alerting Infrastructure

**Input**: Design documents from `specs/008-oci-monitoring-alerting/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup & Foundational

- [x] T001 Ensure `.gitignore` ignores `*.tfvars`, `*.tfstate`, `*.tfstate.*`, and `.terraform/`
- [x] T002 Update `terraform/main.tf` to declare `notification_email` variable and outputs for monitoring OCIDs

## Phase 2: User Story 1 - Critical Metric Threshold Alerting (Priority: P1)

- [x] T003 [P] [US1] Create `oci_ons_notification_topic` named `pay-to-pin-critical-alerts` in `terraform/monitoring.tf`
- [x] T004 [P] [US1] Create `oci_ons_subscription` for `garretparker@gmail.com` in `terraform/monitoring.tf`
- [x] T005 [P] [US1] Create `oci_monitoring_alarm.cpu_high` (>85% CPU for 5m) in `terraform/monitoring.tf`
- [x] T006 [P] [US1] Create `oci_monitoring_alarm.memory_high` (>85% RAM for 5m) in `terraform/monitoring.tf`
- [x] T007 [P] [US1] Create `oci_monitoring_alarm.disk_high` (>85% Disk for 5m) in `terraform/monitoring.tf`
- [x] T008 [P] [US1] Create `oci_monitoring_alarm.instance_health` (Infrastructure unhealthy) in `terraform/monitoring.tf`

## Phase 3: User Story 2 - Gateway Health Probe & Downtime Alerts (Priority: P1)

- [x] T009 [P] [US2] Create `oci_health_checks_http_monitor.gateway_health` probing `https://pay-to-pin.duckdns.org/health` in `terraform/monitoring.tf`
- [x] T010 [P] [US2] Create `oci_monitoring_alarm.http_gateway_down` (HTTP health check failure alert) in `terraform/monitoring.tf`

## Phase 4: Polish & Documentation

- [x] T011 Update `terraform/terraform.tfvars.example` with `notification_email` documentation
- [x] T012 Run `terraform validate` to verify HCL syntactical correctness and OCI schema validity
