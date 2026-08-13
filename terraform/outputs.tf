# OCI Load Balancer Outputs

output "load_balancer_ip" {
  value       = oci_load_balancer_load_balancer.pay_to_pin_lb.ip_address_details[0].ip_address
  description = "Public IP address of the Flexible Load Balancer"
}

output "load_balancer_ocid" {
  value       = oci_load_balancer_load_balancer.pay_to_pin_lb.id
  description = "OCID of the Flexible Load Balancer"
}
