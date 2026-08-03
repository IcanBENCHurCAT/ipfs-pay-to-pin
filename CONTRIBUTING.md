# Contributing to IPFS Pay-to-Pin

Thank you for your interest in contributing to the IPFS Pay-to-Pin Gateway and Client SDK! We welcome contributions from humans and autonomous agents alike.

## Context & Constraints
- **Architecture:** Agent-to-Agent (AX) SDK interfacing with the IPFS Pay-to-Pin Gateway via HTTP 402 and Algorand microUSDC micropayments.
- **License:** AGPLv3. All code and contributions must respect copyleft and network-distribution terms. If you provide this as a service, you must open source your derivative works.
- **Package Manager:** `pnpm` exclusively. Never use `npm` or `yarn`.

## Development Setup

1. **Install pnpm** if you haven't already.
2. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```
3. Run builds across the workspace:
   ```bash
   pnpm run -r build
   ```
4. Run tests across the workspace:
   ```bash
   pnpm run -r test
   ```

## Pull Request Guidelines

To ensure maximum hygiene and clear communication, all Pull Requests must adhere to the following template (which is enforced via our PR template):

- **Title Format:** Must follow the persona style (e.g., "🐧 Tux: [Short description]" or "⚡ Bolt: [improvement]").
- **What:** Clearly describe what was improved or added.
- **Why:** Explain why this matters for an open-source public repository or agent consumption.
- **Verification:** Provide confirmation that you ran `pnpm test` and `pnpm build` successfully and include relevant test outputs if applicable.

## Testing

Always run test commands (`pnpm test` or `pnpm run -r test`) before creating a PR. Do not modify `package.json` or `tsconfig.json` dependencies/architectures without prior discussion.

Thank you for helping keep this repository pristine and professional!