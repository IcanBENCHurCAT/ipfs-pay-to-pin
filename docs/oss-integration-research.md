# OSS Integration Research — IPFS Pay-to-Pin

## Summary

We surveyed the Web3 boilerplate and NFT template ecosystem on GitHub to identify 2-3 actively-maintained projects that currently use Pinata or Infura for IPFS storage, making them ideal "guerrilla" integration targets for Pay-to-Pin.

**Key finding:** There is a structural gap in the ecosystem. Most popular Web3 boilerplates with 500+ stars either use abstraction layers (thirdweb, Moralis, Filebase) that internally handle IPFS pinning, or they are archived/inactive. Projects that explicitly integrate Pinata/Infura directly tend to have fewer stars (50-400 range) but are more amenable to adding Pay-to-Pin as a provider option without architectural changes.

**Strategy:** Target both high-star repos that embed IPFS storage *and* smaller-but-active repos where Pinata/Infura are first-class, explicit dependencies. The latter category offers cleaner integration paths with higher acceptance rates for OSS contributions.

---

## Target Repositories

### 1. Ethereum Boilerplate — Full-Stack NFT Marketplace

- **URL:** https://github.com/ethereum-boilerplate/ethereum-nft-marketplace-boilerplate
- **Stars:** 869 ⭐ | Forks: 972
- **Tech Stack:** JavaScript, Next.js, Hardhat, Ethers.js, Web3.js
- **Existing IPFS Provider:** Uses Moralis SDK (which abstracts IPFS/Infura internally)
- **Why it's a good fit:** Largest NFT marketplace boilerplate in the ecosystem with strong community adoption. Despite using Moralis as the primary abstraction, the project has clear separation between storage logic and contract logic, making Pay-to-Pin a viable drop-in alternative.
- **Integration approach:** Create a Pay-to-Pin adapter alongside the existing Moralis IPFS adapter. Users could choose between providers via environment variables or config flags. This is a non-breaking addition that benefits users who want pay-as-you-go storage without Moralis subscription tiers.
- **PR strategy:** The repo has 972 forks, indicating a large community of downstream users. Open a feature branch with the Pay-to-Pin adapter, reference the growing demand for provider flexibility, and tag @ethereum-boilerplate maintainers. The existing test suite provides a model for integration tests.
- **Activity:** Last pushed 2024-01-03. ⚠️ **Inactive for 1+ year.** Consider this a "stealth" target — reach out via Discord/socials first to gauge maintainer interest before submitting a PR.
- **Risk:** Low activity means slow review cycles. Fork + submit PR in parallel may be necessary.

---

### 2. Ethereum Boilerplate — Main Boilerplate

- **URL:** https://github.com/ethereum-boilerplate/ethereum-boilerplate
- **Stars:** 4,137 ⭐ | Forks: 1,000+
- **Tech Stack:** TypeScript, Next.js, Hardhat, Moralis SDK, React
- **Existing IPFS Provider:** Moralis SDK (handles IPFS pinning via Infura/Filebase/their own infrastructure)
- **Why it's a good fit:** The #1 most-starred Web3 boilerplate. 4K+ stars means maximum visibility for Pay-to-Pin. While it uses Moralis as the storage abstraction layer, the project explicitly aims for provider flexibility ("works with any EVM system"). Adding Pay-to-Pin as an additional storage backend aligns with this ethos.
- **Integration approach:** Add a Pay-to-Pin storage module to the boilerplate's existing storage layer. Users select their provider via config. Since Moralis is the current default, Pay-to-Pin becomes an opt-in alternative for users wanting no-subscription IPFS pinning.
- **PR strategy:** This is a flagship project with the ethereum-boilerplate org. Engage on GitHub Discussions first, then submit a PR with a demo app showing Pay-to-Pin in action. The large community means PRs get eyeballs — but also scrutiny for quality.
- **Activity:** Last pushed 2024-06-19. Moderately active but declining. ⚠️ Not a top priority given the Moralis lock-in nature.
- **Risk:** The Moralis dependency is deep in the codebase. Pay-to-Pin would need to coexist without becoming the default.

---

### 3. turbo-eth Web3 App Template

- **URL:** https://github.com/turbo-eth/template-web3-app
- **Stars:** 385 ⭐ | Forks: 99
- **Tech Stack:** TypeScript, Next.js, RainbowKit, SIWE, Disco, Wagmi, Viem
- **Existing IPFS Provider:** None currently (no IPFS storage integrated)
- **Why it's a good fit:** Clean, modern Web3 stack with no IPFS integration yet — meaning Pay-to-Pin could be introduced as a *first-class* feature rather than a replacement. The architecture is opinionated but extensible, and the template uses Wagmi/Viem which is exactly the stack Pay-to-Pin targets.
- **Integration approach:** Add a Pay-to-Pin IPFS storage module as a template feature. The clean Next.js + RainbowKit + SIWE stack makes this a natural fit for a "connect wallet → upload to IPFS → mint" flow. Since there's no existing IPFS provider to replace, this is a greenfield integration.
- **PR strategy:** The turbo-eth org has an active community. Propose Pay-to-Pin as a "storage provider" option in the template's docs, with a toggle via env vars. The absence of existing IPFS usage means zero risk of breaking anything.
- **Activity:** Last pushed 2024-05-03. ⚠️ Below 500-star threshold but highly aligned with Pay-to-Pin's tech stack.
- **Risk:** Moderate. No existing IPFS code means this is a new feature add, not a provider switch. The maintainer community tends to be responsive.

---

### 4. aquiladev/ipfs-action (GitHub Action)

- **URL:** https://github.com/aquiladev/ipfs-action
- **Stars:** 179 ⭐ | Forks: 47
- **Tech Stack:** JavaScript, Node.js (GitHub Action)
- **Existing IPFS Provider:** **Pinata, Infura, Filebase, and direct IPFS** — multi-provider by design
- **Why it's a good fit:** This is arguably the **best integration target**. It already supports 4 IPFS pinning services (Pinata, Infura, Filebase, direct upload) with a unified `service:` config parameter. Adding Pay-to-Pin as a 5th provider is a natural extension that fits the existing architecture perfectly. The multi-provider design is exactly the pattern Pay-to-Pin wants to promote.
- **Integration approach:** Add `paytopin` as a new `service` option in the `ipfs-action` GitHub Action. This means: adding a Pay-to-Pin upload function, updating the README with examples, and adding integration tests. The existing pattern (`pinata`, `infura`, `filebase`) provides a clear template to follow.
- **PR strategy:** High acceptance probability. The action is already multi-provider, so this is additive. Reference the existing `filebase` implementation as a model. The author (aquiladev) is responsive to issues and PRs based on the action's 29 releases and active issue resolution.
- **Activity:** Last pushed 2024-09-01. Actively maintained with 238 commits and 29 releases. ✅ Meets activity criteria.
- **Risk:** Low. The architectural pattern already exists. This is a straightforward add-on.

---

### 5. yusefnapora/minty (NFT Minting CLI)

- **URL:** https://github.com/yusefnapora/minty
- **Stars:** 470 ⭐ | Forks: 145
- **Tech Stack:** JavaScript, Node.js CLI
- **Existing IPFS Provider:** **Pinata and nft.storage** — both explicitly supported via separate `.env` files
- **Why it's a good fit:** The README explicitly states "Any service that implements the IPFS Remote Pinning API can be used with Minty" and provides example configs for both Pinata (`config/pinata.env.example`) and nft.storage. Pay-to-Pin implements the IPFS Remote Pinning API, so this is a drop-in addition.
- **Integration approach:** Add a `minty pin --service paytopin` command alongside the existing `minty pin` commands. The CLI's env-file architecture makes this trivial — just add `config/paytopin.env.example` with the Pay-to-Pin API key format.
- **PR strategy:** High acceptance probability. The author explicitly designed minty to be provider-agnostic. The implementation pattern already exists for Pinata and nft.storage, so this follows a proven path.
- **Activity:** Last pushed 2022-05-26. ⚠️ **Inactive for 2+ years.** Low priority due to abandonment.
- **Risk:** Moderate. The repo is inactive but the code is stable. A PR may sit unreviewed for months. Could fork and maintain a Pay-to-Pin fork independently.

---

### 6. Lastrust NFT Boilerplate

- **URL:** https://github.com/lastrust/boilerplate-for-nft
- **Stars:** 6 ⭐ (below threshold)
- **Tech Stack:** TypeScript, Hardhat, React
- **Existing IPFS Provider:** **Pinata** — explicitly recommended in README ("Pinata is easy to use")
- **Why it's a good fit:** The entire README is a step-by-step tutorial for uploading NFT data to IPFS via Pinata. It's a beginner-friendly boilerplate with clear, isolated IPFS upload code. Adding Pay-to-Pin as an alternative would be a natural improvement.
- **Integration approach:** Add a Pay-to-Pin upload module alongside the Pinata one. Users toggle between providers via a simple config flag.
- **PR strategy:** Very small project (6 stars). The maintainer (lastrust) likely has a small Discord/community. Direct outreach via Discord is the best approach.
- **Activity:** Last pushed 2024-04-18. ⚠️ Below 500-star threshold. Consider a "long shot" — easy to integrate but limited reach.

---

## Evaluation Summary

| Repo | Stars | Active? | Uses Pinata/Infura? | Integration Fit | Risk |
|------|-------|---------|---------------------|-----------------|------|
| ethereum-boilerplate NFT marketplace | 869 | ❌ 1+yr | Moralis (abstracts IPFS) | Medium | High (inactive) |
| ethereum-boilerplate main | 4,137 | ⚠️ 1yr+ | Moralis (abstracts IPFS) | Medium | High (deep Moralis lock-in) |
| turbo-eth template-web3-app | 385 | ⚠️ 2yr+ | ❌ None yet | High | Moderate (new feature) |
| **aquiladev/ipfs-action** | 179 | ✅ Active | **Pinata + Infura + Filebase** | **Very High** | **Low** |
| yusefnapora/minty | 470 | ❌ 2yr+ | **Pinata + nft.storage** | **Very High** | Moderate (inactive) |
| lastrust/boilerplate-for-nft | 6 | ⚠️ 2yr+ | **Pinata** | High | Low (easy) |

---

## Recommended Priority Order

1. **aquiladev/ipfs-action** — Best fit. Already multi-provider, actively maintained, clean integration path. Low risk, high reward.
2. **yusefnapora/minty** — Excellent integration fit (Pinata + nft.storage → add Pay-to-Pin), but inactive. Fork if PRs stall.
3. **turbo-eth/template-web3-app** — No existing IPFS = clean greenfield integration. Below star threshold but high alignment with Pay-to-Pin's stack (Wagmi/Viem/Next.js).
4. **ethereum-boilerplate repos** — High reach but low activity and deep Moralis abstraction. Treat as secondary targets; engage via Discord/socials first.

---

## Why Pay-to-Pin Wins

- **Pay-as-you-go vs monthly subscriptions** — Pinata's paid tiers and Infura's rate limits force users into fixed-cost plans. Pay-to-Pin charges only per upload, matching actual usage.
- **Native USDC on Algorand** — Fast, cheap microtransactions enable true per-call billing without gas overhead.
- **x402 machine-readable payments** — Perfect for AI agents that need to programmatically pay for IPFS pinning as part of automated workflows.
- **Open-source, no vendor lock-in** — Unlike Moralis or thirdweb, Pay-to-Pin gives users full control over their data and billing.
- **Complements, doesn't replace** — Pay-to-Pin works alongside existing providers. Users can switch between Pinata, Infura, Filebase, and Pay-to-Pin based on their use case, cost, or geographic location.
- **Developer experience** — The IPFS Remote Pinning API is already supported by minty, ipfs-action, and the Pinata SDK. Pay-to-Pin plugs into the existing ecosystem without requiring new tooling.

---

## Additional Research Notes

### Ecosystem Context

The Web3 boilerplate ecosystem has two clear segments:

1. **Abstraction-layer projects** (thirdweb, Moralis, Alchemy) — 10K+ stars, but they abstract away IPFS entirely. Pay-to-Pin integration would require fighting their storage abstraction, which is unlikely to succeed.

2. **Explicit IPFS provider projects** (minty, ipfs-action, lastrust/nft) — Lower stars (6-470), but IPFS is a first-class concept. These are where Pay-to-Pin has a realistic shot.

### Why 500+ Stars Is a Soft Threshold

Most repos with 500+ stars that use IPFS either:
- Use abstraction layers (thirdweb's `uploadToIPFS`, Moralis' `pinJson`, etc.)
- Are archived or abandoned (mirshko/next-web3-boilerplate: 607 stars, archived 2024-06)
- Are tutorial/demo repos that don't have real maintainers

The gap between "popular enough to matter" and "explicitly uses IPFS" is real. The candidates below 500 stars (ipfs-action, minty, turbo-eth) are the ones with the best **combined** fit across all evaluation criteria, even if they fall short on pure star count.

### Outreach Strategy

1. **First pass:** Open PRs to aquiladev/ipfs-action and turbo-eth/template-web3-app (both have reasonable maintenance activity)
2. **Second pass:** Fork yusefnapora/minty and submit a PR; if unreviewed after 2 weeks, maintain the fork with Pay-to-Pin as default
3. **Third pass:** Engage ethereum-boilerplate maintainers on Discord/socials before submitting PRs to their repos
4. **Ongoing:** Track PR acceptance rates and engagement to refine future targets
