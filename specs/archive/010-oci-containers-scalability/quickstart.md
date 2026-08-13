# Quickstart: Validation Guide

Follow these steps to validate the OCI Container auto-scaling deployment.

## Prerequisites
- Terraform v1.5+
- OCI CLI configured locally with valid credentials
- Docker image pushed to OCI Registry (OCIR)

## 1. Apply Infrastructure
Navigate to the terraform directory and apply the configuration to provision the Load Balancer, FSS, and Autoscaling policies.
```bash
cd terraform
terraform init
terraform apply -auto-approve
```
*Expected Outcome*: Terraform successfully applies and outputs the Load Balancer Public IP. No container instances should be running initially.

## 2. Test Scale-Out (0 -> 1)
Send an HTTP request to the Load Balancer Public IP.
```bash
export LB_IP=$(terraform output -raw load_balancer_ip)
curl -i http://$LB_IP/api/v1/health
```
*Expected Outcome*: The request may pause while OCI provisions the first container (cold start), then return a `200 OK` response.

## 3. Test Scale-In (1 -> 0)
Wait for 5 minutes without sending any HTTP requests to the Load Balancer.

*Expected Outcome*: The OCI Monitoring Alarm triggers the scale-in policy, terminating the container instance. OCI console should show 0 active Container Instances.
