# Quickstart & Verification Guide: OCI Monitoring & Alerting

## Prerequisites
- OCI CLI or API Key configured with tenancy permissions.
- Terraform `>= 1.2.0` installed.
- Valid `terraform.tfvars` file populated locally (excluded from git via `.gitignore`).

---

## 1. Syntax & Schema Validation

Run Terraform validation to verify provider compatibility and resource definitions:

```bash
cd terraform
terraform init
terraform validate
```

---

## 2. Dry-Run Execution Plan

Run Terraform plan to inspect resources to be provisioned:

```bash
terraform plan
```

**Expected Output**:
- `+ oci_ons_notification_topic.pay_to_pin_alerts`
- `+ oci_ons_subscription.email_subscription`
- `+ oci_health_checks_http_monitor.gateway_health`
- `+ oci_monitoring_alarm.cpu_high`
- `+ oci_monitoring_alarm.memory_high`
- `+ oci_monitoring_alarm.disk_high`
- `+ oci_monitoring_alarm.instance_health`
- `+ oci_monitoring_alarm.http_gateway_down`

---

## 3. Deployment & Confirmation

Apply the configuration to OCI:

```bash
terraform apply -auto-approve
```

> [!IMPORTANT]
> Check inbox at `garretparker@gmail.com` for an email from **Oracle Cloud Infrastructure Notifications** and click **Confirm Subscription**.

---

## 4. Verification & Testing

1. **ONS Subscription Verification**:
   Navigate to **Observability & Management -> Notifications -> Topics -> pay-to-pin-critical-alerts** in the OCI Console. Verify subscriber `garretparker@gmail.com` is in state `Confirmed`.

2. **Alarm Verification**:
   Navigate to **Observability & Management -> Alarm Management**. Verify all 5 alarms are in state `OK` / `Firing` based on current metrics.
