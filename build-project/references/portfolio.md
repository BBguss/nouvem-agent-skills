# Portfolio / personal site

## Typical features
- [ ] Home with name, role, one-line value statement, primary call to action (contact, CV, hire me)
- [ ] Projects/work grid with detail pages (problem, role, stack, outcome, images, links)
- [ ] About page, skills, experience timeline
- [ ] Contact: mailto link or a form with spam protection (honeypot or captcha) and a server/form-service endpoint
- [ ] CV/resume download (PDF) and social links
- [ ] Optional: blog/notes (see `cms-blog.md`), dark mode, i18n
- [ ] 404 page, favicon set, social share image

## Data model sketch
Usually content files, not a database:
```
Project { slug, title, summary, role, stack[], year, cover, gallery[], links{live,repo}, featured, body(markdown) }
Experience { org, title, from, to, highlights[] }
Post { slug, title, date, tags[], body }   // only if blog
```
Keep content in Markdown/MDX/JSON inside the repo unless a non-developer edits it (then a headless CMS).

## Recommended stacks
1. **Static site generator** (Astro, Eleventy, Hugo) + Markdown content → static host/CDN. Default: fastest, near-zero cost, no server.
2. **React meta-framework in static export mode** (Next.js `output: export`, Nuxt generate, SvelteKit adapter-static) when the owner wants rich interactivity or already knows the framework.
3. **Plain HTML/CSS + a little JS** for a one-page site; no build step at all.
Contact form without a backend: a form service or a single serverless function.

## Security musts
- No email address in plain text if spam matters (form or obfuscation); rate-limit and validate any form endpoint.
- No secrets in client bundles; form service keys are public-safe only if the provider says so.
- Security headers on the host (CSP basic, `X-Content-Type-Options`, `Referrer-Policy`).

## SEO / a11y musts
- Unique `<title>` and meta description per page, Open Graph and Twitter card image, canonical URL.
- `sitemap.xml`, `robots.txt`, JSON-LD `Person` (and `CreativeWork` for projects).
- Optimized images (modern formats, width/height set, lazy below the fold), fonts preloaded or system stack.
- Semantic headings (one `h1`), alt text that describes the work, visible focus, contrast AA, works without JS.

## Definition of done
- Lighthouse (mobile) performance, a11y, SEO, best practices all >= 90 (`web-quality-audit`).
- Every project page reachable from the grid; no broken links (link checker run).
- Contact path tested end to end (message actually arrives).
- Responsive at 360/768/1440; deploy preview URL shared with the owner.
