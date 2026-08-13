# Data Model: Infrastructure State

This feature primarily introduces changes to infrastructure state rather than application database tables.

## Terraform State Components

### OCI Container Instance Profile
- **Name**: `gateway_container`
- **Shape**: `CI.Standard.A1.Flex` (ARM) or `CI.Standard.E4.Flex` (AMD)
- **Memory**: 1GB per instance
- **Volume Mounts**:
  - `/app/queue` -> OCI File Storage (FSS)

### OCI Autoscaling Policy
- **Metric**: Load Balancer HTTP Request Rate
- **Thresholds**:
  - > 0 requests/min for 1 min: Scale out (0 -> 1, or N -> N+1)
  - 0 requests/min for 5 mins: Scale in (N -> 0)
