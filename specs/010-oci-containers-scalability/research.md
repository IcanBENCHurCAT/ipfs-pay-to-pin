# Research & Decisions: OCI Containers Auto-scaling

## Unknown 1: 0-to-N HTTP Auto-scaling with OCI Container Instances
- **Decision**: We will use an OCI Flexible Load Balancer coupled with OCI Monitoring Alarms to trigger an OCI Function or native Autoscaling policy that provisions/deprovisions Container Instances based on HTTP request rates.
- **Rationale**: OCI Container Instances do not inherently wake up from 0 based on an incoming HTTP request on a port. A load balancer is required to queue the request while an alarm triggers the provisioning of the first container.
- **Alternatives considered**: Migrating to OKE with Knative (rejected due to cluster management overhead).

## Unknown 2: Shared State Persistence for Local Fallback Registry
- **Decision**: We will mount an OCI File Storage (FSS) volume to the Container Instances to hold the `queue/registry.json`.
- **Rationale**: The constitution mandates atomic file replacement for the registry fallback. A shared NFS mount (via FSS) ensures that all active containers see the same registry state, and data is preserved when containers scale to 0.
- **Alternatives considered**: Relying strictly on Supabase and abandoning local file fallback (rejected as it violates the zero-dependency fallback requirement).

## Unknown 3: CI/CD Pipeline and OCI Authentication
- **Decision**: We will use GitHub Actions to build the Docker container and push it to OCI Container Registry (OCIR). We will configure Workload Identity Federation (WLIF) using an OCI Identity Provider mapped to GitHub's OIDC endpoint (`https://token.actions.githubusercontent.com`).
- **Rationale**: WLIF eliminates the need to store long-lived OCI user credentials or API keys in GitHub Secrets. It is the most secure way for GitHub Actions to authenticate, build, and deploy to OCI.
- **Alternatives considered**: Storing an OCI API Key and Tenant ID in GitHub Secrets (rejected due to security risks associated with long-lived static credentials).
