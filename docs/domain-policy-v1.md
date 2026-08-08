# Domain Policy V1 Foundation

This foundation translates the approved Pokémon TCG Drop Tracker scope into pure,
deterministic TypeScript policy modules. Nothing in `backend/src/index.ts`, runtime
routes, database access, scraping, scheduling, notifications, frontend code, or
deployment imports these modules yet.

## Canonical scope

- Retailers: Pokémon Center, Target, Best Buy, and Walmart.
- Product types: Special Collection, ETB, Booster Bundle, and Booster Box.
- Geography: United States only, with pickup ZIP code 29631.
- Seller policy: first-party inventory only.
- Priority: Tier 1, Best Value, Drop Readiness Score, Star Rating, then Recency.

## Deterministic cadence

`calculateCadence()` returns 60, 30, 15, 10, or 5 minutes from its inputs. The
active-drop-window target is exactly five minutes. Random jitter and retailer
backoff belong in the future scheduler/worker layer and are intentionally absent.

## Unresolved workbook rumor formula

The workbook's Rumors / Chatter readiness formula multiplies its calculated
0-100 credibility score by `12` before adding other bonuses and capping at 100.
This appears likely to saturate the readiness score for modest credibility values.

V1 does not silently change, normalize, or implement that expression. The exact
workbook behavior is recorded in `tracker-policy.v1.ts` as an unresolved policy
decision. A later change must explicitly choose whether to preserve or revise it.

## Release-calendar scope mismatch

The workbook release calendar contains helper rows for Premium Collection and PC
ETB, while the canonical sync configuration scopes the app to the four product
types above. V1 follows the canonical scope and treats other product types as
ineligible until an explicit scope change is approved.
