## 2023-10-27 - Enhance CI/CD Type Checking for SDK

**Learning:** The project relies on pnpm workspaces, and default tsc checks from the root may overlook subpackages if tsconfig is not properly mapped. Also, test states (like local `queue/` files) must be strictly cleaned up to avoid polluting pull requests.
**Action:** When adding CI checks for a specific workspace package, use the `pnpm --filter <package-name>` syntax. Always ensure `git clean -fd` or similar checks are made to prevent stray mock test artifacts from being committed.

## 2024-08-20 - Enforce Pull Request Titles & .gitignore Artifact Polish

**Learning:** When dealing with CI/CD checks for specific PR title formats, conventional commit parsers (like `amannn/action-semantic-pull-request`) do not inherently support spaces or emojis in the `<type>` field (e.g., `🐧 Tux`). Instead, standard bash `grep` rules inside GitHub workflows offer the simplest and most robust approach to custom semantic enforcement. Also, when modifying `.gitignore` for a directory like `queue/`, it's safer to just ignore the whole directory (and explicitly track files you need) rather than try to wildcard specific test output names, as tests can generate new arbitrary mock files like `registry.json` dynamically.
**Action:** Use native bash string validation (`grep -E`) for custom persona-based PR title workflows to bypass strict conventional commit validation limits. When managing test artifacts, strictly ignore the entire artifact root path in `.gitignore` rather than sub-targeting specific file extensions to prevent future untracked mock states from leaking.
## 2024-08-24 - [Remove npm usage from GitHub Actions] \n **Learning:** To ensure true package manager exclusivity, verify all CI workflows are utilizing the desired package manager (pnpm), as boilerplate actions frequently use npm by default. Node versions should also rely on `.node-version` where available for a single source of truth. \n **Action:** Always audit workflow `.yml` files for hardcoded package manager commands or versions when working under strict dependency constraints.

## 2026-03-30 - Unit Testing renew_pin in Python SDK

**Learning:** When mocking x402 payment flows in Python SDK unit tests using `algosdk.transaction`, `AlgodClient.suggested_params()` must return a valid `SuggestedParams` object containing a base64-encoded genesis hash (`gh`) rather than a default `MagicMock` to prevent `base64.b64decode` type errors during transaction dictification and signing.
**Action:** Use `SuggestedParams(fee=..., first=..., last=..., gh=base64.b64encode(...).decode(), gen=...)` in test mocks when verifying Algorand payment signing flows.
