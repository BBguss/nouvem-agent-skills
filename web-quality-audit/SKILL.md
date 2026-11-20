---
name: web-quality-audit
description: Use when asked to improve or audit a website's quality - portfolio, landing page, blog/CMS, e-commerce page, SaaS app or dashboard - covering Lighthouse scores, Core Web Vitals, SEO, structured data, "AI/agent friendliness" (llms.txt), page speed, bundle size, accessibility, responsive layout, "optimasi SEO", "perf pass", "make it crawlable". Runs a measurable before/after pass with reported numbers and ships it through the project's release flow.
---

# Web quality audit

Model- and harness-agnostic. Neutral terms follow `task-delegation`.

## When to use
- Use for cross-page quality: Lighthouse scores, Core Web Vitals (LCP, INP, CLS), SEO metadata, structured data, AI-agent documents, bundle, images, fonts, cache, accessibility, responsive layout.
- Do not use for one visual bug or a new feature (test responsiveness in step 7 only). Full security audit: the project's security skill.
- Lighthouse/E2E is heavy: run via `remote-offload`. Releases via `release-deploy`.

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<SITE_URLS>` | URLs audited (public + signed-in) | `https://<domain>/`, `/pricing`, `/blog/<post>`, `/app` |
| `<PAGE_TYPES>` | which page types exist | portfolio, landing, blog/CMS, shop, SaaS app, dashboard |
| `<ROUTE_LIST>` | public routes that must be indexed | home, pricing, articles, product pages |
| `<SIGNED_IN_ROUTES>` | authenticated routes (must be noindex) | `/app/*`, `/admin/*`, `/dashboard/*` |
| `<BUILD_CMD>` | build + prerender/SSR | `npm run build`, `next build`, `astro build` |
| `<RUN_OFFLOAD>` | where Lighthouse/browser runs | worker node, CI, see `remote-offload` |
| `<RELEASE_FLOW>` | the project's release flow | see `release-deploy` |
| `<BREAKPOINTS>` | responsive test widths | 360, 390, 768, 1024, 1440 |
| `<SCORE_TARGET>` | agreed score target | e.g. 90 or more per category |
| `<I18N_RULE>` | language/dictionary rule | every key exists in every locale |

Focus by page type: portfolio/landing = LCP, images, metadata, OG cards; blog/CMS = article JSON-LD, 404s, sanitised content, feeds; e-commerce = Product/Offer JSON-LD, CLS, INP; SaaS app and dashboard = bundle size, INP, noindex, a11y, responsive tables/charts, lazy heavy widgets.

## Steps
1. Baseline (before changing anything). Run Lighthouse mobile and desktop on each `<SITE_URLS>` (`npx lighthouse <url> --output=json`, PageSpeed Insights, or CI); record Performance, Accessibility, SEO, Best Practices, plus LCP/INP or TBT/CLS and initial JS size. No baseline, no "improved" claim. Run 2-3 times if results wobble. Signed-in pages: use a saved auth state or a test account on dev, never prod accounts.
2. SEO of public pages (each route in `<ROUTE_LIST>`):
   - unique `<title>` and meta description, `link rel=canonical`, `og:*` and `twitter:*`, `lang`, viewport.
   - valid JSON-LD matching real content (Organization/WebSite/Person/Article/BlogPosting/Product/FAQ/BreadcrumbList), never fictional; validate with a schema validator.
   - `sitemap.xml` lists all public routes; `robots.txt` references it.
   - A real 404 status for missing routes (not 200 with a "not found" page); 301 for moved URLs.
   - Crawlable routes need content in the HTML (prerender or SSR), not an empty SPA shell. Check with `curl` without JavaScript.
   - `<SIGNED_IN_ROUTES>`: `noindex` (meta or `X-Robots-Tag`), excluded from the sitemap.
3. Agent/AI friendliness. Provide `llms.txt` (site summary + key links) and optionally `llms-full.txt`; a plain-HTML fallback readable without JS; machine-readable docs (OpenAPI/markdown) for APIs. Check that the CDN/WAF/robots do not accidentally block AI crawlers (e.g. default bot rules), following the owner's policy.
4. Performance.
   - Code-split heavy routes; lazy-load sockets, editors, charts and non-active locale dictionaries; split heavy layouts/shells.
   - Images: webp/avif with `srcset`/`sizes`, explicit dimensions (prevents CLS), `loading=lazy` below the fold, LCP image preloaded and not lazy.
   - Fonts: preload critical fonts, `font-display: swap`, subset where possible.
   - Cache: hashed assets `Cache-Control: public, max-age=31536000, immutable`; HTML not cached long. gzip/brotli on. Third-party scripts deferred or removed.
   - Re-measure the initial bundle; report before/after.
5. Accessibility. Labels on all inputs and icon controls (`aria-label`), sufficient contrast, landmarks (`header/nav/main/footer`), one `h1`, heading order, visible focus, meaningful alt text, keyboard-reachable controls, status not conveyed by colour alone; dashboards: accessible tables and chart alternatives.
6. Renderer safety. Every markdown/shortcode/HTML renderer fed by user or CMS content: test XSS (`<script>`, `onerror=`, `javascript:` URLs, shortcode attributes) and make sure it is sanitised or escaped. Fix findings, do not just log them.
7. Responsive at `<BREAKPOINTS>`: no horizontal page scroll, nothing outside the viewport, labels/buttons not clipped, text wraps, console clean. Take screenshots as evidence. Wide tables become cards on narrow screens. Follow `<I18N_RULE>` for any added text.
8. Re-measure (step 1) and compare with the baseline and `<SCORE_TARGET>`. A score that dropped in another category: fix it or report it honestly.
9. Release via `<RELEASE_FLOW>` (`release-deploy`), then re-measure on the live URL: check `robots.txt`, `sitemap.xml`, `llms.txt`, 404 status, cache headers and the home page. Record results via `definition-of-done` / `living-docs`.

## Fixed rules
- Real numbers only: actual Lighthouse runs, not estimates. No fake data in the UI or in JSON-LD.
- One big change per measurement: measure after each group of big changes so you know what helped.
- Never reduce function for a score (removing features, hiding content from users).
- Bilingual content: lazy dictionaries must not cause empty or flickering text on first render.
- Read-only until the user approves the changes; never change production outside `<RELEASE_FLOW>`.

## Report
A short before -> after table (mobile/desktop x 4 categories, LCP/INP/CLS, initial JS size), changes per area (SEO, agent docs, performance, a11y, responsive, XSS), live-check results, and what still misses the target with the reason.
