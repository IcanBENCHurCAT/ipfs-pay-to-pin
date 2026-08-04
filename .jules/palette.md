## 2025-08-03 - Custom Error Classes for Better Resilience
**Learning:** Generic error classes make it difficult for agents to robustly capture and handle programmatic failures resulting from budget exceedances or user-declined price prompts in micropayment APIs.
**Action:** Always provide explicit, custom error types (e.g. `InsufficientBudgetError`, `PaymentDeclinedError`) for specific failure modes so consuming agents can conditionally recover or adjust behavior.
