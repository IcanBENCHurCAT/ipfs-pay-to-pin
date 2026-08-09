# Feature Specification: OCI Monitoring and Alerting Infrastructure

**Feature Branch**: `008-oci-monitoring-alerting`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "comprehensive monitoring and alerting solution designed to send critical thresholds as an email to garretparker@gmail.com"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Critical Metric Threshold Alerting (Priority: P1)

As a Cloud Operations Engineer, I want the OCI monitoring system to track CPU, Memory, Disk, and Host Infrastructure health on the gateway virtual machine so that critical resource exhaustion or hardware degradation triggers an immediate alert.

**Why this priority**: High resource utilization or host failure directly impacts gateway availability and pay-to-pin transactions. Real-time notifications are essential for high availability.

**Independent Test**: Can be tested by simulating metric alarms in OCI Monitoring or lowering alarm threshold temporarily, verifying email dispatch to `garretparker@gmail.com`.

**Acceptance Scenarios**:

1. **Given** sustained CPU utilization > 85% for 5 minutes, **When** the monitoring evaluation window elapses, **Then** OCI Monitoring transitions the CPU alarm to `CRITICAL` state and dispatches an email notification to `garretparker@gmail.com`.
2. **Given** sustained RAM or Root Disk utilization > 85% for 5 minutes, **When** the alarm condition evaluates, **Then** an email alert is sent to `garretparker@gmail.com` with metric details and timestamp.
3. **Given** an infrastructure failure or host degradation on the compute instance, **When** the instance health check evaluates, **Then** a critical alert is triggered immediately via ONS.

---

### User Story 2 - Gateway Health Probe & Downtime Alerts (Priority: P1)

As an API Consumer / System Administrator, I want synthetic HTTP health probes to monitor `https://pay-to-pin.duckdns.org/health` every minute so that gateway downtime is detected within 60 seconds.

**Why this priority**: Outer-loop availability probing ensures we know when the public API endpoint fails even if the underlying compute instance is technically running.

**Independent Test**: Can be tested by temporarily stopping the Docker container or blocking port 443, verifying the Health Check monitor registers failure and dispatches an alert.

**Acceptance Scenarios**:

1. **Given** the gateway container stops or returns non-200 responses on `/health`, **When** the OCI Health Check monitor runs its 60-second probe, **Then** the probe status transitions to failed and triggers a critical email alert to `garretparker@gmail.com`.
2. **Given** the gateway recovers and returns HTTP 200 OK on `/health`, **When** the probe executes, **Then** the alarm transitions back to OK and dispatches a recovery notification.

---

### User Story 3 - Notification Topic Email Subscription Management (Priority: P2)

As a Cloud Administrator, I want an OCI Notification Topic (ONS) provisioned via Terraform with `garretparker@gmail.com` registered as an email subscriber so that all future infrastructure alerts route through a centralized, managed topic.

**Why this priority**: Provides a clean, decoupled messaging pipeline for infrastructure alerts that can be expanded to SMS, PagerDuty, or Slack webhooks in the future.

**Independent Test**: Can be tested by applying Terraform and confirming receipt of the OCI ONS confirmation email at `garretparker@gmail.com`.

**Acceptance Scenarios**:

1. **Given** a new deployment via Terraform, **When** `terraform apply` executes, **Then** an OCI ONS topic `pay-to-pin-critical-alerts` and subscription for `garretparker@gmail.com` are created, triggering an opt-in confirmation email to the subscriber.

---

### Edge Cases

- What happens when `garretparker@gmail.com` has not yet confirmed the ONS email subscription? (OCI holds alarms until confirmed; documentation and Terraform output highlight confirmation step).
- How does the system handle temporary network blips on health checks? (Health Check alarm requires sustained failures before escalating to reduce false positives).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provision an OCI Notification Service (ONS) Topic named `pay-to-pin-critical-alerts`.
- **FR-002**: System MUST subscribe `garretparker@gmail.com` to the ONS topic via EMAIL protocol.
- **FR-003**: System MUST create an OCI Monitoring Alarm for Compute CPU Utilization triggering when `CpuUtilization > 85%` for 5 consecutive minutes.
- **FR-004**: System MUST create an OCI Monitoring Alarm for Compute Memory Utilization triggering when `MemoryUtilization > 85%` for 5 consecutive minutes.
- **FR-005**: System MUST create an OCI Monitoring Alarm for Compute Disk Utilization triggering when `DiskUtilization > 85%` for 5 consecutive minutes.
- **FR-006**: System MUST create an OCI Monitoring Alarm for Compute Infrastructure Health triggering on non-healthy instance status.
- **FR-007**: System MUST configure an OCI HTTP Health Check monitor polling `https://<duckdns_subdomain>.duckdns.org/health` every 60 seconds with an associated downtime alarm.

### Key Entities

- **Notification Topic**: OCI ONS messaging channel used to aggregate and route alarm events.
- **Email Subscription**: Registered subscriber endpoint (`garretparker@gmail.com`) receiving payload notifications.
- **Monitoring Alarm**: Rule definition evaluating MQL metric queries over a time window and triggering actions.
- **HTTP Health Monitor**: Synthetic probe service continuously testing public API accessibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Critical compute resource exhaustion (CPU/RAM/Disk > 85%) triggers an email alert to `garretparker@gmail.com` within 5 minutes of sustained load.
- **SC-002**: Gateway endpoint failure (`/health` non-200 or unreachable) triggers an email alert within 120 seconds of failure onset.
- **SC-003**: 100% of monitoring resources (Topic, Subscription, Alarms, Health Check) are declared as Infrastructure-as-Code in Terraform without manual OCI Console configuration.
- **SC-004**: Zero sensitive variables or secrets exposed in Git repository (`terraform.tfvars` added to `.gitignore`).

## Assumptions

- OCI compute instance runs Oracle Cloud Agent (`oci-compute-agent`) for memory and disk telemetry extraction.
- Subscriber has access to `garretparker@gmail.com` to click the initial ONS confirmation link.
- Gateway endpoint `/health` returns HTTP 200 OK when operational.
