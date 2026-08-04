# Contributing to IPFS Pay-to-Pin Gateway

Welcome to the IPFS Pay-to-Pin Gateway repository! We appreciate your interest in contributing to our open-source project. This document provides guidelines and instructions for contributing.

## Development Environment Setup

This repository uses **pnpm exclusively** as its package manager. **Do not use npm or yarn.**

1. **Install pnpm**: If you don't have pnpm installed, you can install it via npm: `npm install -g pnpm`.
2. **Install dependencies**: Run `pnpm install` in the root directory.
3. **Build the project**: This is a monorepo workspace. Run `pnpm run -r build` to build all workspaces.
4. **Run tests**: Execute `pnpm test` from the root directory to run the main Vitest test suite.

## Pull Request Guidelines

We have strict rules for pull request formatting. When you open a PR, please ensure you use the provided Pull Request Template and follow these guidelines:

### PR Titles

Your PR title **must** start with the appropriate persona prefix, reflecting the nature of your contribution:

*   **🐧 Tux:** `[Short description of repository hygiene/maturity improvement]` (Documentation, CI/CD, project setup)
*   **⚡ Bolt:** `[Short description of performance improvement]` (Speed, resource optimization)
*   **🎨 Palette:** `[Short description of AX/DX improvement]` (Agent/Developer experience, APIs, strict typing)
*   **🛡️ Sentinel:** `[Severity] Fix [vulnerability]` (Security fixes)

### PR Description Format

Your PR description must include the following sections (as outlined in our template):

*   **What**: A clear description of what was improved or added.
*   **Why**: An explanation of why this matters for the public repository, human developers, or autonomous agent consumers.
*   **Verification / Impact**: Confirmation that local validation steps (like `pnpm test` and `pnpm run -r build`) passed successfully. For performance improvements, document the expected impact.

## Licensing and Copyleft

This project is licensed under the **GNU Affero General Public License v3 (AGPLv3)**.

By contributing to this repository, you agree that your contributions will be licensed under its AGPLv3 license. This copyleft license ensures that anyone offering this agent-to-agent protocol as a network service must open-source their derivative works.

## General Rules

*   **Security First**: Never commit secrets or hardcode sensitive information. If you find a security vulnerability, please address it carefully or report it securely. Do not expose vulnerability details publicly in PRs.
*   **No Breaking Changes**: Avoid making breaking changes without prior discussion and approval, especially to public APIs that autonomous agents rely on.
*   **Testing**: Always run test commands before creating a PR. Ensure your changes do not introduce regressions.

Thank you for contributing!
