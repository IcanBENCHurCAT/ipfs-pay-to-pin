# OCI Container Scalability Variables

variable "oci_compartment_ocid" {
  type        = string
  description = "The OCID of the compartment where container resources will be provisioned."
  default     = ""
}

variable "container_image_url" {
  type        = string
  description = "The OCIR URL of the gateway docker image."
  default     = "iad.ocir.io/tenancy/pay-to-pin-gateway:latest"
}

variable "min_instances" {
  type        = number
  description = "Minimum number of container instances (0 for scale-to-zero)."
  default     = 0
}

variable "max_instances" {
  type        = number
  description = "Maximum number of container instances to scale out."
  default     = 5
}
