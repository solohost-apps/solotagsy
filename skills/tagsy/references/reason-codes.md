# Tagsy reason codes

The API returns these stable codes plus numbers, never English sentences. Render them through `scripts/render.js` with the user's language file. Adding a code is a contract change and needs a template in every shipped locale.

| Code | Plain meaning |
| --- | --- |
| `sale_verified` | Sale confirmed against the Pi ledger. |
| `payment_not_on_chain` | Reported payment not found on-chain. |
| `receipt_unconfirmed` | Physical goods reward held pending buyer receipt confirmation or dispute-window timeout. |
| `dispute_window_open` | Dispute window still open; reward not final yet. |
| `reward_pending_approval` | Reward prepared, awaiting weekly approval. |
| `reward_final` | Reward final and payable. |
| `listing_admitted` | Producer listing admitted by the rulebook. |
| `listing_not_admitted` | Listing held out by the rulebook. |
| `cap_exceeded` | Daily attestation or budget cap hit. |
| `under_review` | Decision under manual review. |
| `decision_final` | Decision closed. |
| `appeal_submitted` | Appeal filed, awaiting review. |
| `appeal_upheld` | Appeal accepted, decision changed. |
| `appeal_denied` | Appeal rejected, original decision stands. |
| `appeal_under_review` | Appeal being reviewed. |
| `question_answered` | Question answered with rule citation. |

Source of truth: `pi-next/contract/api-contract.md` section 4.
