---
name: algorand-development
description: Comprehensive guide for Algorand development with AlgoKit — project initialization, CLI commands, example search, contract building workflows, ARC standards, and error troubleshooting. This is the parent skill for language-agnostic Algorand development. Use when working with AlgoKit CLI, searching for examples, understanding ARC standards, creating new projects, or troubleshooting errors. Strong triggers include "algokit init", "algokit project run build", "start localnet", "find an example", "search for contract", "ARC-4", "ARC-56", "logic eval error", "transaction rejected", "overspend", "create a new project", "initialize project".
---

# Algorand Development

This is the aggregated parent skill for language-agnostic Algorand development tools, workflows, and standards. Use the reference files below to find detailed guidance for each topic.

## Quick Start

```bash
# Install AlgoKit CLI
pipx install algokit

# Create a new project
algokit init -n my-project -t typescript --answer preset_name production --defaults

# Development cycle
algokit project run build    # Compile contracts
algokit project run test     # Run tests
algokit localnet start       # Start local network
algokit project deploy localnet  # Deploy
```

## Reference Guide

Navigate to the appropriate reference based on your task.

### AlgoKit CLI Commands

Build, test, deploy, and manage local networks with AlgoKit CLI.

- `use-algokit-cli.md` — CLI workflow and common commands
- `use-localnet.md` — Localnet lifecycle, reset, and account management

### Contract Architecture & Building Workflows

Design principles, ARC standards, compilation, testing, and deployment.

- `arc-standards.md` — Complete index of ARCs (ARC-4 ABI, ARC-32, ARC-56 application specs)
- `contract-design-principles.md` — Architecture patterns, state layout, MBR optimizations, and security best practices
- `contract-compilation.md` — Build steps and artifact generation
- `contract-testing-and-deployment.md` — Testing strategies, deployment scripts, and idempotent deployment logic

### Troubleshooting & Debugging

Diagnostic steps and fixes for common Algorand development errors.

- `troubleshooting-errors.md` — Execution failures (logic eval error, overspend, rekeying, MBR issues), deployment errors, network issues, and SDK errors
