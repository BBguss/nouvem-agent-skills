# CMS / blog / content site

## Typical features
- [ ] Post list with pagination, post detail, categories/tags, author pages
- [ ] Search (static index or DB full-text), related posts
- [ ] Editor experience: drafts, preview, scheduled publish, revisions, media library with alt text
- [ ] Roles: admin, editor, author (author edits own posts only)
- [ ] Comments (own moderation queue or a third-party service) - optional
- [ ] RSS/Atom feed, newsletter signup
- [ ] Redirects manager for changed slugs; 404 with search
- [ ] i18n if multilingual (per-locale slugs and `hreflang`)

## Data model sketch
```
User { id, email, name, role(admin|editor|author), password_hash }
Post { id, slug(unique per locale), title, excerpt, body, cover_id, status(draft|scheduled|published), published_at, author_id, locale, seo{title,description,og_image} }
Category { id, slug, name }   Tag { id, slug, name }   PostTag { post_id, tag_id }
Media { id, path, mime, width, height, alt, uploaded_by }
Redirect { from_path, to_path, code }
Revision { id, post_id, body, created_by, created_at }
```

## Recommended stacks
1. **Static generator + Markdown/MDX in git** (Astro, Hugo, Eleventy) when authors are developers. Cheapest, fastest.
2. **Headless CMS + static/ISR front end** (a hosted or self-hosted headless CMS feeding Next.js/Nuxt/Astro) when non-developers write. Rebuild/revalidate on publish via webhook.
3. **Traditional full CMS** (WordPress-class, or a framework admin such as Django/Laravel based) when plugins, editors' familiarity or hosting constraints win.

## Security musts
- Sanitize rich text/HTML on save and render (allow-list); never trust editor HTML.
- Uploads: type and size checks, re-encode images, store outside executable paths, no SVG with scripts.
- Role checks server-side on every mutation (authors cannot publish or edit others' posts unless allowed).
- Admin behind auth with rate-limited login, 2FA for admins; CSRF protection on forms.
- Keep CMS core and plugins updated; disable unused endpoints (e.g. XML-RPC style APIs).

## SEO / a11y musts
- Per-post title/meta/OG image, canonical, `Article`/`BlogPosting` JSON-LD with author and dates.
- Server-rendered or prerendered HTML for posts (crawlable without JS); real 404 status for missing slugs.
- Sitemap updated on publish, RSS feed, `hreflang` for locales, clean slugs, 301 on slug change.
- Image alt text required in the media library; heading order in content; readable line length and font size.

## Definition of done
- Create, preview, schedule, publish, edit and unpublish a post end to end as an author and as an editor.
- Published post appears in list, feed, sitemap and search; unpublished does not.
- Lighthouse >= 90 on a post page; missing slug returns 404.
- Backups of DB and media configured (or content lives in git).
