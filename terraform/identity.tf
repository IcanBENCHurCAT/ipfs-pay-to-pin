# OCI Identity Provider & Workload Identity Federation (WLIF) for GitHub Actions OIDC

resource "oci_identity_identity_provider" "github_oidc" {
  compartment_id = var.tenancy_ocid
  name           = "GitHubActionsOIDC"
  protocol       = "SAML2"
  product_type   = "IDCS"
  description    = "Workload Identity Federation for GitHub Actions CI/CD pipeline"
  metadata       = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
  metadata_url   = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
  freeform_tags  = { "ManagedBy" = "Terraform" }
}

resource "oci_identity_policy" "github_actions_ocir_policy" {
  compartment_id = var.compartment_ocid
  name           = "github-actions-ocir-deploy-policy"
  description    = "Allows GitHub Actions OIDC identity to push container images to OCIR"
  statements     = [
    "Allow dynamic-group GitHubActionsGroup to manage repos in compartment id ${var.compartment_ocid}",
    "Allow dynamic-group GitHubActionsGroup to use buckets in compartment id ${var.compartment_ocid}"
  ]
}
