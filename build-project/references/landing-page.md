# Landing page / marketing site

## Typical features
- [ ] Hero: headline (outcome, not feature), subhead, one primary CTA, supporting visual
- [ ] Social proof (logos, testimonials, numbers that are real and sourced)
- [ ] Features/benefits sections, how it works, pricing table if relevant
- [ ] FAQ (also as FAQPage structured data), final CTA
- [ ] Lead capture: signup/waitlist/contact form wired to a real destination (email tool, CRM, DB)
- [ ] Legal: privacy policy, terms, cookie consent where analytics/ads require it
- [ ] Analytics with consent; UTM capture into the lead record
- [ ] Optional: multiple language versions, A/B variants, blog for SEO (`cms-blog.md`)

## Data model sketch
```
Lead { id, email, name?, source, utm{source,medium,campaign}, consent_at, created_at }
```
Often no own DB: forward to an email/CRM provider via a serverless function.

## Recommended stacks
1. **Static generator** (Astro/Eleventy/Hugo) + one serverless function for the form. Default.
2. **Meta-framework** (Next.js/Nuxt/SvelteKit) with static pages when the landing lives next to the app and shares components.
3. **Hosted page builder or CMS** when marketers must edit layout without developers (trade-off: performance and lock-in).

## Security musts
- Form endpoint: server-side validation, rate limit, bot protection (honeypot, captcha/turnstile-style challenge), double opt-in for mailing lists.
- No API keys in the page; the function holds them via env.
- Consent recorded before setting non-essential cookies.

## SEO / a11y musts
- One `h1` with the main keyword; descriptive title/meta; Open Graph image 1200x630.
- Fast LCP: hero image optimized and preloaded, no render-blocking third-party scripts, analytics deferred.
- JSON-LD `Organization`/`Product`/`FAQPage` as fitting; `sitemap.xml`, `robots.txt`, canonical.
- Optional `llms.txt` summarizing the product for AI agents.
- Contrast AA, buttons are real buttons/links, form fields labeled, error messages announced.

## Definition of done
- Lighthouse mobile >= 90 on all four categories; LCP < 2.5 s, CLS < 0.1 on a mid device profile.
- A test lead submitted end to end lands in the destination with UTM values.
- Every CTA goes to a working target; legal pages present.
- Responsive check 360/390/768/1024/1440.
