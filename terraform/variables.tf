# OCI Container Scalability Variables

variable "oci_compartment_ocid" {
  type        = string
  description = "The OCID of the compartment where container resources will be provisioned."
  default     = ""
}

variable "container_image_url" {
  type        = string
  description = "The container image URL of the gateway."
  default     = "ghcr.io/icanbenchurcat/pay-to-pin-gateway:latest"
}

variable "ghcr_username" {
  type        = string
  description = "GitHub username or organization for GHCR image pulls"
  default     = "IcanBENCHurCAT"
}

variable "ghcr_pat" {
  type        = string
  description = "GitHub Personal Access Token for pulling GHCR container images"
  sensitive   = true
  default     = ""
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
