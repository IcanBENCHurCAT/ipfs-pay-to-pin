# Feature Specification: Migrate from VMs to OCI Containers with Auto-scaling

**Feature Branch**: `010-oci-containers-scalability`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "migrating from terraform VMs to OCI Containers (with scalability 0->N based on traffic)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scale on Demand (Priority: P1)

When traffic increases, the gateway automatically provisions additional OCI containers to handle the load. When traffic drops to zero, the containers scale down to 0 to save costs.

**Why this priority**: Core requirement for migrating to a scalable, cost-effective container architecture.

**Independent Test**: Can be fully tested by sending concurrent requests to the gateway endpoint and observing container instance counts in OCI metrics, followed by a period of inactivity to observe scale-down.

**Acceptance Scenarios**:

1. **Given** 0 active containers, **When** a new HTTP request arrives, **Then** a new container is provisioned to serve it and the request is successfully handled (cold start).
2. **Given** multiple active containers, **When** traffic drops to zero and a cooldown period passes, **Then** all active containers scale down to exactly 0.
3. **Given** 1 active container, **When** concurrent request volume exceeds the container's capacity, **Then** additional containers are provisioned to handle the load.

---

### User Story 2 - Infrastructure Provisioning via Terraform (Priority: P2)

The deployment infrastructure is entirely codified using Terraform, transitioning from static VM resources to dynamic container deployment configurations.

**Why this priority**: Ensures the new architecture remains reproducible and maintainable through Infrastructure as Code (IaC).

**Independent Test**: Can be fully tested by running `terraform apply` on a fresh environment and successfully deploying the gateway without manual intervention.

**Acceptance Scenarios**:

1. **Given** an empty OCI compartment, **When** the terraform scripts are applied, **Then** all necessary networking, IAM policies, and container configurations are successfully provisioned.

### Edge Cases

- What happens when a request arrives during a cold start and provisioning takes too long? (Timeout handling)
- How does the system handle database connection limits when scaled to N instances? (Connection pooling/limits)
- How are local files (like the fallback queue registry) persisted across ephemeral container lifecycles?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST deploy the backend service as an OCI Container.
- **FR-002**: System MUST automatically scale the number of running containers based on incoming HTTP traffic.
- **FR-003**: System MUST scale down to exactly zero instances when there is no traffic for a predefined cooldown period.
- **FR-004**: System MUST utilize Terraform to manage the new OCI container infrastructure.
- **FR-005**: System MUST use OCI Container Instances (Serverless) for 0-to-N scaling.
- **FR-006**: System MUST persist the pin registry state reliably despite the ephemeral nature of containers (e.g., via Supabase or mounted object storage).

### Key Entities

- **OCI Container**: The ephemeral runtime environment executing the Hono API gateway.
- **Terraform Configuration**: The IaC definitions defining the container deployment and auto-scaling rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: System successfully scales from 0 to 1 instance upon receiving a request within an acceptable cold start time (e.g., < 10 seconds).
- **SC-002**: Compute resource costs are completely eliminated (scaled to 0) when traffic is zero.
- **SC-003**: All infrastructure can be provisioned via a single `terraform apply` command without manual console steps.
- **SC-004**: The gateway correctly processes x402 payments and IPFS pinning while running in the new container environment.

## Assumptions

- Assumes Supabase PostgreSQL is the primary database and will not be disrupted by container scale-out.
- Assumes the existing multi-stage Dockerfile is suitable for OCI Containers without major modifications.
- Assumes the current Oracle Cloud Always-Free tier or existing limits support the required container service.
