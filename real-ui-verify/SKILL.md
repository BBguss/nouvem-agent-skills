---
name: real-ui-verify
description: Use when a UI change must be proven to work before calling it done - "test it in the browser", "check on mobile", "is it responsive", "E2E test", "screenshot the page", "does the desktop app still open", "cek di HP", "uji tampilan", "tes beneran", or when tests pass but nobody has looked at the real screen. Runs the real app (not mocks) through a viewport or OS matrix with Playwright or WebDriver, checks real data or an honest empty state, captures screenshots as evidence, and can run on a worker node.
---

# Real UI verify

Origin: a hosting panel's rules "real E2E, no fake tests" and "responsive is mandatory" (Playwright on a worker node at 360/390/768/1024/1440 px, screenshots as proof, real data or "No data", never mocked numbers). Model-agnostic, any front-end stack.

Unit tests prove the code; this skill proves what a person sees.

## When to use / not
- Use after any change to pages, components, layout, styles, copy, navigation or desktop windows, and before `definition-of-done` claims a UI task finished.
- Do not use for pure backend changes (use the project's tests), for a full SEO or speed audit (`web-quality-audit`), or for a broken local setup (`local-dev-setup`).

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<APP_URL>` | where the app under test runs | `http://localhost:5173`, a staging URL |
| `<TEST_ACCOUNT>` | test login from seed or fixture files | `seed/users.json` (never a real user's password) |
| `<VIEWPORTS>` | web widths | `360,390,768,1024,1440` |
| `<DESKTOP_TARGETS>` | OS and scaling | `win11@100%,150%`, `macOS@2x`, `ubuntu@100%` |
| `<RUNNER_HOST>` | where browsers run | local, a worker node, CI (see `remote-offload`) |
| `<EVIDENCE_DIR>` | screenshots and traces | `test-results/ui/<date>/` |

## Steps
1. **Pick the flows** touched by the change: the page itself plus one flow before and after it (e.g. list → edit → saved toast). Write them as plan steps.
2. **Run the real app** with real or seeded data. No mocked API responses, no hard-coded numbers in the UI. Empty data must show an honest empty state ("No data yet"), never invented values.
3. **Drive it** with a real browser or app driver:
   - Web: Playwright (or Cypress) against `<APP_URL>`, log in with `<TEST_ACCOUNT>`.
   - Electron: Playwright `_electron.launch`. Tauri or native: WebDriver (tauri-driver, WinAppDriver, Appium Mac2).
4. **Matrix.** For each flow:
   - Web: every width in `<VIEWPORTS>`; check no horizontal scroll, nothing cut off, tap targets at least 44 px on phones, text readable, menus reachable. Light and dark theme if the app has both.
   - Desktop: every target in `<DESKTOP_TARGETS>`; check the window opens, scales sharply, menus and shortcuts work, file dialogs open, the app closes cleanly.
5. **Assert, not just look.** Each step checks something concrete: element visible, text present, URL changed, no console errors, no failed network requests, no error dialog.
6. **Evidence.** Save a screenshot per flow per matrix cell in `<EVIDENCE_DIR>`, plus a trace or video when a step fails. Look at the screenshots yourself; a passing run with a broken layout is still broken.
7. **Heavy runs** (many viewports, several browsers): run on `<RUNNER_HOST>` through `remote-offload`, bring back exit code and evidence.
8. **On failure:** fix, rerun the failing cell, then rerun the whole flow once. Three failures in a row on the same step: stop and report (`definition-of-done`).

### Same skill, three kinds of project
| | Portfolio / static site | Desktop app | SaaS / web app |
|---|---|---|---|
| Flows | home, project detail, contact form submit, 404 | first launch, open/save a file, settings, update prompt, quit | sign up/login, main dashboard, create/edit/delete, billing page, error state |
| Matrix | `<VIEWPORTS>` plus a Lighthouse run on home | `<DESKTOP_TARGETS>`, plus offline start | `<VIEWPORTS>`, roles (admin/user), empty and full accounts |
| Data | real content from the CMS or markdown | a real sample file set, a fresh profile | seeded tenant with real-shaped data; empty tenant for "No data" |
| Typical catch | hero text overflows at 360 px, form posts to nowhere | blurry icons at 150%, window opens off-screen | table cut off on tablets, KPI shows `NaN` instead of "No data" |

## Doc trail
Follows `living-docs` section 7.
- `plan.md`: flows and matrix as checkbox steps; tick each cell as it passes.
- `checkpoint.md` field **Tests**: the command, the matrix (e.g. "5 viewports x 3 flows, 15/15 pass"), and the evidence folder.
- `docs/error-runbook.md` part B: a UI bug that slipped past unit tests (what broke, at which width or OS, why).

## Fixed rules
- No mocks for the thing being verified, no fake numbers, no "it should work".
- A UI task is not done without at least one real screenshot per changed flow.
- Use test accounts only; never a real customer's login.
- Tests that start apps on shared machines can affect production: check production after a big run when they share hosts.

## Report
Result first: matrix size and pass count, failures with the cell (flow, width or OS) and a screenshot path, what was fixed.
