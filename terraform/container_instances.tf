# OCI Container Instance Configuration

resource "oci_container_instances_container_instance" "pay_to_pin_container" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[var.availability_domain_index].name
  display_name        = "ipfs-pay-to-pin-container"
  container_restart_policy = "ALWAYS"
  shape               = "CI.Standard.A1.Flex"

  shape_config {
    ocpus         = 1
    memory_in_gbs = 2
  }

  vnics {
    subnet_id        = oci_core_subnet.pay_to_pin_subnet.id
    display_name     = "pay-to-pin-container-vnic"
    is_public_ip_assigned = false
  }

  containers {
    display_name = "gateway-app"
    image_url    = var.container_image_url

    environment_variables = {
      PORT                   = "4021"
      NODE_ENV               = "production"
      ALGORAND_NETWORK       = "mainnet"
      ESCROW_ADDRESS         = var.escrow_address
      EVM_ESCROW_ADDRESS     = var.evm_escrow_address
      SOLANA_ESCROW_ADDRESS  = var.solana_escrow_address
      FACILITATOR_URL        = "https://facilitator.goplausible.xyz"
      PINATA_JWT             = var.pinata_jwt
      SUPABASE_URL           = var.supabase_url
      SUPABASE_KEY           = var.supabase_key
      ALLOW_LOCAL_FALLBACK   = "false"
    }

    volume_mounts {
      mount_path  = "/app/queue"
      volume_name = "queue-storage"
    }
  }

  volumes {
    name         = "queue-storage"
    volume_type  = "CONFIGFILE"
  }

  graceful_shutdown_timeout_in_sec = 30
}
