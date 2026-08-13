# OCI Monitoring Alarms & Auto-Scaling Configuration for Container Instances

# Alarm: Scale-Out when HTTP Traffic > 0
resource "oci_monitoring_alarm" "container_scale_out_alarm" {
  compartment_id        = var.compartment_ocid
  destinations          = [oci_ons_notification_topic.pay_to_pin_alerts.id]
  display_name          = "pay-to-pin-http-scale-out-alarm"
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_loadbalancer"
  query                 = "HttpRequests[1m].sum() > 0"
  severity              = "CRITICAL"
  body                  = "HTTP Traffic detected on Load Balancer. Triggering container scale-out from 0 to N."

  pending_duration = "PT1M"
}

# Alarm: Scale-In when HTTP Traffic == 0 for 5 Minutes
resource "oci_monitoring_alarm" "container_scale_in_alarm" {
  compartment_id        = var.compartment_ocid
  destinations          = [oci_ons_notification_topic.pay_to_pin_alerts.id]
  display_name          = "pay-to-pin-http-scale-in-alarm"
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_loadbalancer"
  query                 = "HttpRequests[5m].sum() == 0"
  severity              = "INFO"
  body                  = "Zero HTTP Traffic detected over 5m window. Triggering scale-down to 0 instances."

  pending_duration = "PT5M"
}
