# Analysis templates

## Problem statement
```
Observed:   <what happens, exact message/number>
Expected:   <what should happen>
Where:      <environment, URL/endpoint/command, component>
Since:      <first seen; last known good>
Frequency:  <always / intermittent n of m / under load / specific users>
Impact:     <who and how badly; workaround?>
Repro:      <steps, or "not yet reproduced">
```

## Hypothesis table
Keep it updated as tests run. Likelihood: H/M/L. Cost: minutes to test.

| # | Hypothesis | Evidence for | Evidence against | Likelihood | Cost | Test that decides it | Result |
|---|---|---|---|---|---|---|---|
| H1 | Regression from commit `abc123` (query changed) | started after deploy on day X; slow log shows the new query | - | H | 5 | run old vs new query with EXPLAIN on same data | confirmed: seq scan |
| H2 | Data growth crossed a threshold | table grew 3x | issue began abruptly | M | 10 | compare row counts at good/bad dates | killed |
| H3 | Not a bug: cached old asset in the browser | one user only | other users too | L | 2 | hard reload / private window | killed |

Order of testing: sort by (likelihood x information gained) / cost. Tests that halve the search space go first.

## 5-whys
Stop when the answer is something you can change that prevents the whole class, not just this instance. Branch if a "why" has two real answers.
```
Problem: Checkout page takes 8 s to load.
1. Why? The order-summary API call takes 7 s.
2. Why? It runs one query per cart item (N+1) against the products table.
3. Why? The serializer lazily loads product relations.
4. Why? The ORM default is lazy loading and no test guards query counts.
5. Why? There is no query-count budget in the API test suite.
Root cause: missing eager loading + no guard against N+1.
Fix: eager-load relations (fix) + add a query-count assertion to API tests (prevention).
```

## Comparison of working vs broken
| Dimension | Working | Broken | Different? |
|---|---|---|---|
| Version / commit | | | |
| Runtime / dependency versions | | | |
| Config / env / feature flags | | | |
| Data (size, specific record) | | | |
| Infrastructure (node, region, browser, OS) | | | |
| User / role / tenant | | | |

## Options table
| Option | What changes | Risk | Effort | Verify by | Downtime |
|---|---|---|---|---|---|
| A. Mitigate | | | | | |
| B. Fix | | | | | |
| C. Prevent | | | | | |
Recommendation: <option + reason>.

## Decision record (for design/architecture questions)
```
Question:  <decision to make>
Context:   <constraints, scale, team skills, budget, deadlines>
Options:   <2-4, each with pros/cons and rough cost>
Criteria:  <ranked: e.g. correctness > operability > cost > speed of delivery>
Decision:  <chosen option, or "needs owner decision">
Revisit:   <signal that would make us reconsider>
```
Route the final record with `living-docs`.
