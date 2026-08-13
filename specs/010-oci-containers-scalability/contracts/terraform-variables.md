# Interface Contract: Terraform Variables

The new infrastructure deployment requires the following variables to be defined in `terraform.tfvars`:

```hcl
variable "oci_compartment_ocid" {
  type        = string
  description = "The OCID of the compartment where resources will be provisioned."
}

variable "container_image_url" {
  type        = string
  description = "The OCIR URL of the gateway docker image."
}

variable "min_instances" {
  type        = number
  description = "Minimum number of container instances. Should be 0 for zero-cost idle."
  default     = 0
}

variable "max_instances" {
  type        = number
  description = "Maximum number of container instances to scale to."
  default     = 5
}
```
