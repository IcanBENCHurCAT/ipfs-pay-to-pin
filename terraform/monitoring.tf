# OCI Notification Topic (ONS)
resource "oci_ons_notification_topic" "pay_to_pin_alerts" {
  compartment_id = var.compartment_ocid
  name           = "pay-to-pin-critical-alerts"
  description    = "Notification topic for IPFS Pay-to-Pin Gateway critical infrastructure alarms"
}

# Notification Subscription (Email Alerting)
resource "oci_ons_subscription" "email_subscription" {
  compartment_id = var.compartment_ocid
  topic_id       = oci_ons_notification_topic.pay_to_pin_alerts.id
  protocol       = "EMAIL"
  endpoint       = var.notification_email
}

# HTTP Health Checks Probe
resource "oci_health_checks_http_monitor" "gateway_health" {
  compartment_id      = var.compartment_ocid
  display_name        = "pay-to-pin-gateway-http-check"
  targets             = ["${var.duckdns_subdomain}.duckdns.org"]
  protocol            = "HTTPS"
  port                = 443
  path                = "/health"
  interval_in_seconds = 60
  timeout_in_seconds  = 10
  method              = "GET"
  is_enabled          = true
}

# Monitoring Alarm: Compute High CPU Utilization (> 85% for 5 mins)
resource "oci_monitoring_alarm" "cpu_high" {
  compartment_id        = var.compartment_ocid
  display_name          = "pay-to-pin-cpu-utilization-high"
  destinations          = [oci_ons_notification_topic.pay_to_pin_alerts.id]
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_computeagent"
  query                 = "CpuUtilization[1m]{resourceId = \"${oci_core_instance.pay_to_pin_vm.id}\"}.mean() > 85"
  severity              = "CRITICAL"
  pending_duration      = "PT5M"
  body                  = "CRITICAL ALERT: CPU utilization on IPFS Pay-to-Pin Gateway VM has exceeded 85% for 5 minutes."
}

# Monitoring Alarm: Compute High Memory Utilization (> 85% for 5 mins)
resource "oci_monitoring_alarm" "memory_high" {
  compartment_id        = var.compartment_ocid
  display_name          = "pay-to-pin-memory-utilization-high"
  destinations          = [oci_ons_notification_topic.pay_to_pin_alerts.id]
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_computeagent"
  query                 = "MemoryUtilization[1m]{resourceId = \"${oci_core_instance.pay_to_pin_vm.id}\"}.mean() > 85"
  severity              = "CRITICAL"
  pending_duration      = "PT5M"
  body                  = "CRITICAL ALERT: Memory utilization on IPFS Pay-to-Pin Gateway VM has exceeded 85% for 5 minutes."
}

# Monitoring Alarm: Compute High Disk Utilization (> 85% for 5 mins)
resource "oci_monitoring_alarm" "disk_high" {
  compartment_id        = var.compartment_ocid
  display_name          = "pay-to-pin-disk-utilization-high"
  destinations          = [oci_ons_notification_topic.pay_to_pin_alerts.id]
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_computeagent"
  query                 = "DiskUtilization[1m]{resourceId = \"${oci_core_instance.pay_to_pin_vm.id}\"}.mean() > 85"
  severity              = "CRITICAL"
  pending_duration      = "PT5M"
  body                  = "CRITICAL ALERT: Root disk space utilization on IPFS Pay-to-Pin Gateway VM has exceeded 85% for 5 minutes."
}

# Monitoring Alarm: Instance Infrastructure Degraded / Unhealthy
resource "oci_monitoring_alarm" "instance_health" {
  compartment_id        = var.compartment_ocid
  display_name          = "pay-to-pin-instance-health-degraded"
  destinations          = [oci_ons_notification_topic.pay_to_pin_alerts.id]
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_compute_infrastructure_health"
  query                 = "instance_status[1m]{resourceId = \"${oci_core_instance.pay_to_pin_vm.id}\"}.mean() != 1"
  severity              = "CRITICAL"
  pending_duration      = "PT2M"
  body                  = "CRITICAL ALERT: IPFS Pay-to-Pin Gateway VM host infrastructure status is unhealthy or unresponsive."
}

# Monitoring Alarm: HTTP Gateway Endpoint Downtime
resource "oci_monitoring_alarm" "http_gateway_down" {
  compartment_id        = var.compartment_ocid
  display_name          = "pay-to-pin-http-gateway-downtime"
  destinations          = [oci_ons_notification_topic.pay_to_pin_alerts.id]
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_healthchecks"
  query                 = "http_status[1m]{monitorId = \"${oci_health_checks_http_monitor.gateway_health.id}\"}.mean() != 1"
  severity              = "CRITICAL"
  pending_duration      = "PT2M"
  body                  = "CRITICAL ALERT: IPFS Pay-to-Pin Gateway HTTPS health check probing failed. Gateway endpoint is unreachable or returning errors."
}
