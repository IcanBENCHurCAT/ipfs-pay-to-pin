# Data Model & Infrastructure Schema: OCI Monitoring & Alerting

## Entities

### 1. ONS Notification Topic (`oci_ons_notification_topic`)
Represents the OCI Notification Service channel aggregating alarm events.

| Attribute | Type | Description | Example |
|---|---|---|---|
| `id` | string (OCID) | Unique OCI resource identifier | `ocid1.onstopic.oc1..` |
| `compartment_id` | string (OCID) | Target OCI compartment | `var.compartment_ocid` |
| `name` | string | Topic display name | `pay-to-pin-critical-alerts` |
| `description` | string | Human readable summary | `Notification topic for Gateway critical alarms` |

### 2. ONS Email Subscription (`oci_ons_subscription`)
Represents an email subscriber endpoint bound to the ONS Notification Topic.

| Attribute | Type | Description | Example |
|---|---|---|---|
| `id` | string (OCID) | Unique subscription OCID | `ocid1.onssubscription.oc1..` |
| `topic_id` | string (OCID) | Reference to ONS Topic ID | `oci_ons_notification_topic.pay_to_pin_alerts.id` |
| `protocol` | string | Delivery protocol | `EMAIL` |
| `endpoint` | string | Recipient email address | `garretparker@gmail.com` |
| `state` | string | Subscription state | `PENDING` / `ACTIVE` |

### 3. OCI Monitoring Alarm (`oci_monitoring_alarm`)
Defines metric thresholds and alert dispatch rules.

| Attribute | Type | Description | Example |
|---|---|---|---|
| `display_name` | string | Human readable alarm name | `pay-to-pin-cpu-utilization-high` |
| `namespace` | string | Metric namespace | `oci_computeagent` / `oci_healthchecks` |
| `query` | string | MQL query expression | `CpuUtilization[1m].mean() > 85` |
| `severity` | string | Alarm severity level | `CRITICAL` |
| `pending_duration` | string | Duration before triggering | `PT5M` |
| `destinations` | list(string) | Destination ONS Topic OCIDs | `[oci_ons_notification_topic.pay_to_pin_alerts.id]` |
| `is_enabled` | boolean | Alarm enablement status | `true` |

### 4. HTTP Health Monitor (`oci_health_checks_http_monitor`)
Synthetic probe evaluating public web endpoint health.

| Attribute | Type | Description | Example |
|---|---|---|---|
| `display_name` | string | Monitor display name | `pay-to-pin-gateway-http-check` |
| `targets` | list(string) | Target hostnames / IPs | `["pay-to-pin.duckdns.org"]` |
| `protocol` | string | Probe protocol | `HTTPS` |
| `port` | number | Network port | `443` |
| `path` | string | Probe HTTP path | `/health` |
| `interval_in_seconds` | number | Frequency of probes | `60` |
