---
description: "Task list for OCI Containers Scalability feature implementation"
---

# Tasks: Migrate from VMs to OCI Containers with Auto-scaling

**Input**: Design documents from `/specs/010-oci-containers-scalability/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 [P] Define `oci_compartment_ocid`, `container_image_url`, `min_instances`, and `max_instances` in `terraform/variables.tf`
- [x] T002 [P] Expose load balancer IP in `terraform/outputs.tf`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Implement OCI File Storage (FSS) creation and Mount Target for shared container state in `terraform/main.tf`
- [x] T004 Define the base OCI Container Instance resource and shape configuration in `terraform/container_instances.tf`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Scale on Demand (Priority: P1) 🎯 MVP

**Goal**: When traffic increases, the gateway automatically provisions additional OCI containers to handle the load. When traffic drops to zero, the containers scale down to 0 to save costs.

**Independent Test**: Can be fully tested by sending concurrent requests to the gateway endpoint and observing container instance counts in OCI metrics, followed by a period of inactivity to observe scale-down.

### Implementation for User Story 1

- [x] T005 [P] [US1] Provision OCI Flexible Load Balancer and listener rules in `terraform/main.tf`
- [x] T006 [US1] Implement OCI Monitoring Alarms based on HTTP request rate in `terraform/autoscaling.tf`
- [x] T007 [US1] Create Autoscaling Policy bound to the load balancer and container instance pool in `terraform/autoscaling.tf`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Infrastructure Provisioning via Terraform (Priority: P2)

**Goal**: The deployment infrastructure is entirely codified using Terraform, transitioning from static VM resources to dynamic container deployment configurations.

**Independent Test**: Can be fully tested by running `terraform apply` on a fresh environment and successfully deploying the gateway without manual intervention.

### Implementation for User Story 2

- [x] T008 [P] [US2] Configure Workload Identity Federation (WLIF) for GitHub OIDC in `terraform/identity.tf`
- [x] T009 [US2] Create GitHub Actions CI/CD deployment pipeline in `.github/workflows/deploy.yml` to build and push the container to OCIR

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T010 [P] Documentation updates mapping new deployment architecture in `README.md`
- [x] T011 Verify atomic file operations on FSS survive concurrent container scale-out
- [x] T012 Run quickstart.md validation to ensure `terraform apply` works end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Expands on the provisioning logic.

### Within Each User Story

- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch load balancer and metrics in parallel (if terraform state allows):
Task: "Provision OCI Flexible Load Balancer and listener rules in terraform/main.tf"
Task: "Implement OCI Monitoring Alarms based on HTTP request rate in terraform/autoscaling.tf"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Autoscaling)
   - Developer B: User Story 2 (GitHub Actions & WLIF)
3. Stories complete and integrate independently
