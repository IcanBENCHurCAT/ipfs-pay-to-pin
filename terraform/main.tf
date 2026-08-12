terraform {
  required_version = ">= 1.2.0"
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 5.0.0"
    }
  }
}

variable "tenancy_ocid" {
  type        = string
  description = "OCI Tenancy OCID"
}

variable "user_ocid" {
  type        = string
  description = "OCI User OCID"
}

variable "fingerprint" {
  type        = string
  description = "OCI API Key Fingerprint"
}

variable "private_key_path" {
  type        = string
  description = "Path to OCI API Private Key (.pem)"
}

variable "region" {
  type        = string
  default     = "us-ashburn-1"
  description = "OCI Region (e.g. us-ashburn-1, us-phoenix-1)"
}

variable "compartment_ocid" {
  type        = string
  description = "OCI Compartment OCID"
}

variable "ssh_public_key" {
  type        = string
  description = "Public SSH key to inject into instance"
}

# Application Environment Variables
variable "pinata_jwt" {
  type      = string
  sensitive = true
}

variable "supabase_url" {
  type = string
}

variable "supabase_key" {
  type      = string
  sensitive = true
}

variable "duckdns_subdomain" {
  type    = string
  default = "pay-to-pin"
}

variable "duckdns_token" {
  type      = string
  sensitive = true
}

variable "escrow_address" {
  type    = string
  default = "W5IRXJWPSXNUJVSN2MOEJGTDGKUGFKUDVPTR5ZQVMDG5O4KYD5M3QPG3TE"
}

variable "evm_escrow_address" {
  type    = string
  default = "0x0000000000000000000000000000000000000000"
}

variable "solana_escrow_address" {
  type    = string
  default = "11111111111111111111111111111111"
}

variable "notification_email" {
  type        = string
  default     = "your-email@example.com"
  description = "Email address to receive critical OCI monitoring alerts"
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# Virtual Cloud Network (VCN)
resource "oci_core_vcn" "pay_to_pin_vcn" {
  compartment_id = var.compartment_ocid
  cidr_block     = "10.0.0.0/16"
  display_name   = "pay-to-pin-vcn"
  dns_label      = "paytopinvcn"
}

# Internet Gateway
resource "oci_core_internet_gateway" "pay_to_pin_ig" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.pay_to_pin_vcn.id
  display_name   = "pay-to-pin-ig"
  enabled        = true
}

# Route Table
resource "oci_core_route_table" "pay_to_pin_rt" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.pay_to_pin_vcn.id
  display_name   = "pay-to-pin-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.pay_to_pin_ig.id
  }
}

# Security List (Allows SSH 22, HTTP 80, HTTPS 443)
resource "oci_core_security_list" "pay_to_pin_sl" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.pay_to_pin_vcn.id
  display_name   = "pay-to-pin-security-list"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 80
      max = 80
    }
  }

  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 443
      max = 443
    }
  }
}

# Subnet
resource "oci_core_subnet" "pay_to_pin_subnet" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.pay_to_pin_vcn.id
  cidr_block        = "10.0.1.0/24"
  display_name      = "pay-to-pin-subnet"
  dns_label         = "paytopinsubnet"
  route_table_id    = oci_core_route_table.pay_to_pin_rt.id
  security_list_ids = [oci_core_security_list.pay_to_pin_sl.id]
}

variable "availability_domain_index" {
  type        = number
  default     = 0
  description = "Index of availability domain to try (0, 1, or 2 for Ashburn AD-1, AD-2, AD-3)"
}

variable "instance_shape" {
  type        = string
  default     = "VM.Standard.E2.1.Micro"
  description = "OCI Compute Shape (VM.Standard.E2.1.Micro for guaranteed capacity, or VM.Standard.A1.Flex for ARM)"
}

# Fetch Ubuntu 24.04 Image dynamically based on shape
data "oci_core_images" "ubuntu_images" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = var.instance_shape
}

# Compute Instance
resource "oci_core_instance" "pay_to_pin_vm" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[var.availability_domain_index].name
  display_name        = "ipfs-pay-to-pin-gateway"
  shape               = var.instance_shape

  dynamic "shape_config" {
    for_each = length(regexall("Flex", var.instance_shape)) > 0 ? [1] : []
    content {
      ocpus         = 2
      memory_in_gbs = 12
    }
  }

  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.ubuntu_images.images[0].id
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.pay_to_pin_subnet.id
    assign_public_ip = true
    hostname_label   = "pay-to-pin"
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data           = base64encode(replace(<<-EOF
      #!/bin/bash
      set -ex

      # Allow Ports 80 & 443 on IPTables
      iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
      iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
      netfilter-persistent save || true

      # Wait for network connectivity & DNS resolution
      echo "Waiting for internet connectivity..."
      until curl -fsSL --connect-timeout 5 https://archive.ubuntu.com > /dev/null 2>&1; do
        echo "Network/DNS not ready yet, retrying in 5s..."
        sleep 5
      done

      # Create 2GB swap file to prevent OOM during Docker build on 1GB RAM VM
      if [ ! -f /swapfile ]; then
        fallocate -l 2G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        echo "vm.swappiness=10" >> /etc/sysctl.conf
        sysctl vm.swappiness=10
        echo "Swap enabled: $(free -h | grep Swap)"
      fi

      # Retry function for network operations
      retry() {
        local n=1
        local max=10
        local delay=5
        while true; do
          "$@" && break || {
            if [[ $n -lt $max ]]; then
              ((n++))
              echo "Command failed. Attempt $n/$max. Retrying in $delay seconds..."
              sleep $delay
            else
              echo "The command has failed after $max attempts."
              return 1
            fi
          }
        done
      }

      # Install Docker & Docker Compose
      retry apt-get update
      retry apt-get install -y ca-certificates curl gnupg git
      install -m 0755 -d /etc/apt/keyrings
      retry curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
      retry apt-get update
      retry apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

      # Clone Repository
      cd /opt
      rm -rf ipfs-pay-to-pin
      retry git clone https://github.com/IcanBENCHurCAT/ipfs-pay-to-pin.git
      cd ipfs-pay-to-pin

      # Write Environment Variables
      cat <<'ENVEOF' > .env
PORT=4021
NODE_ENV=production
ALGORAND_NETWORK=mainnet
ALGORAND_SERVER=https://mainnet-api.algonode.cloud
ESCROW_ADDRESS=${var.escrow_address}
EVM_ESCROW_ADDRESS=${var.evm_escrow_address}
SOLANA_ESCROW_ADDRESS=${var.solana_escrow_address}
FACILITATOR_URL=https://facilitator.goplausible.xyz
PINATA_JWT=${var.pinata_jwt}
SUPABASE_URL=${var.supabase_url}
SUPABASE_KEY=${var.supabase_key}
DUCKDNS_SUBDOMAIN=${var.duckdns_subdomain}
DUCKDNS_TOKEN=${var.duckdns_token}
ALLOW_LOCAL_FALLBACK=false
ENABLE_AUTOMATIC_REFUNDS=false
ENVEOF

      # Launch Containers
      retry docker compose up -d --build
    EOF
    , "\r", ""))
  }

  lifecycle {
    ignore_changes = [metadata["user_data"]]
  }
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

output "public_ip" {
  value       = oci_core_instance.pay_to_pin_vm.public_ip
  description = "Public IP address of the deployed Gateway"
}

output "gateway_url" {
  value       = "https://${var.duckdns_subdomain}.duckdns.org"
  description = "HTTPS Gateway URL with automated Let's Encrypt SSL"
}

output "notification_topic_ocid" {
  value       = oci_ons_notification_topic.pay_to_pin_alerts.id
  description = "OCID of ONS Notification Topic"
}

output "notification_email" {
  value       = var.notification_email
  description = "Subscribed email address for OCI Monitoring alarms"
}
