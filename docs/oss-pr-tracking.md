# OSS Contribution Tracking — IPFS Pay-to-Pin

> Guerrilla integrations into popular Web3 boilerplates.

## Status

| # | Target Repo | PR URL | Status | Date Opened | Notes |
|---|-------------|--------|--------|-------------|-------|
| 1 | [aquiladev/ipfs-action](https://github.com/aquiladev/ipfs-action) (179⭐) | [PR #82](https://github.com/aquiladev/ipfs-action/pull/82) | Open | 2026-08-10 | Added Pay-to-Pin as 5th pinning service (Pinata, Infura, Filebase, direct, **paytopin**) |
| 2 | [turbo-eth/template-web3-app](https://github.com/turbo-eth/template-web3-app) (385⭐) | [PR #199](https://github.com/turbo-eth/template-web3-app/pull/199) | Open | 2026-08-10 | Added Pay-to-Pin as optional IPFS storage provider with full Next.js integration |

## Research & Planning

- [x] Research complete (`docs/oss-integration-research.md`)
- [x] Targets selected (2 high-priority repos)
- [x] Forks created
  - `IcanBENCHurCAT/ipfs-action` — Pay-to-Pin integration on `feat/paytopin-from-upstream`
  - `IcanBENCHurCAT/template-web3-app` — Pay-to-Pin integration on `integrations`
- [x] Integrations implemented
- [x] PRs submitted
- [ ] Maintainer feedback tracked
- [ ] Follow-ups completed

## Value Proposition Template

> ## Why IPFS Pay-to-Pin?
>
> This PR adds [IPFS Pay-to-Pin](https://github.com/IcanBENCHurCAT/ipfs-pay-to-pin) as an **optional** IPFS storage provider alongside the existing Pinata/Infura integration.
>
> ### Key Benefits
> - **Pay-as-you-go** — no monthly subscriptions or committed spend
> - **Native USDC** — payments in microUSDC on Algorand (sub-cent fees, instant settlement)
> - **x402 machine-readable payments** — perfect for AI agents and programmatic workflows
> - **Open-source SDK** — `npm install ipfs-pay-to-pin-client`, zero vendor lock-in
> - **Complementary** — adds Pay-to-Pin as an additional option, no changes to existing functionality
>
> ### Quick Start for Users
> ```bash
> npm install ipfs-pay-to-pin-client
> # Set env vars: IPFS_PAY_TO_PIN_MNEMONIC, IPFS_PAY_TO_PIN_NETWORK
> ```
>
> See the [npm package](https://www.npmjs.com/package/ipfs-pay-to-pin-client) and [docs](https://github.com/IcanBENCHurCAT/ipfs-pay-to-pin) for full details.
