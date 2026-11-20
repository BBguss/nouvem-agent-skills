# E-commerce / online shop

## Typical features
- [ ] Catalog: categories, products with variants (size/color), images, stock, price, sale price
- [ ] Search, filters (facets), sorting, product detail with variant selection
- [ ] Cart (guest and signed-in, merge on login), coupons/discounts
- [ ] Checkout: address, shipping method and rate, tax, payment via a provider (cards, local methods, e-wallets, bank transfer as relevant to the market)
- [ ] Order lifecycle: pending → paid → fulfilled → shipped → delivered; cancel/refund/return
- [ ] Customer account: orders, addresses, wishlist
- [ ] Emails: order confirmation, payment received, shipped with tracking, refund
- [ ] Back-office: products, inventory, orders, customers, discounts, reports (see `admin-panel-dashboard.md`)
- [ ] Legal: terms, privacy, returns policy, shipping info

## Data model sketch
```
Product { id, slug, title, description, status, category_id, seo{} }
Variant { id, product_id, sku(unique), options{size,color}, price, compare_at_price, stock, weight }
Cart { id, user_id?, session_id, currency, updated_at }   CartItem { cart_id, variant_id, qty }
Order { id, number(unique), user_id?, email, status, currency, subtotal, discount, shipping, tax, total, shipping_address, billing_address, placed_at }
OrderItem { order_id, variant_id, title_snapshot, price_snapshot, qty }
Payment { id, order_id, provider, provider_ref(unique), status, amount, raw_event }
Shipment { id, order_id, carrier, tracking_no, status }
Discount { code, type(percent|fixed), value, min_total, starts_at, ends_at, usage_limit }
```
Money as integer minor units (cents) plus currency code; snapshot prices into orders.

## Recommended stacks
1. **Hosted commerce platform** (with its theme/storefront) - fastest, PCI handled, monthly fee and lock-in.
2. **Headless commerce** (hosted or open-source commerce engine) + custom storefront (Next.js/Nuxt/Astro) for custom UX and performance.
3. **Framework app** (Laravel/Rails/Django/Node + Postgres) with a payment provider's hosted checkout, for small catalogs with unusual rules.
Never handle raw card data yourself; use hosted fields or hosted checkout.

## Security musts
- Prices, discounts, stock and totals computed server-side; the client only sends IDs and quantities.
- Payment confirmation only from verified provider webhooks, idempotent; order transitions in a DB transaction; stock reserved or decremented atomically.
- Rate-limit checkout and coupon endpoints; guard against coupon brute force.
- Order lookup for guests needs order number + email or a signed link (no IDOR).
- PII minimization, encrypted transport, admin 2FA.

## SEO / a11y musts
- Product and category pages prerendered/SSR, `Product` JSON-LD with price, availability, rating if real.
- Canonical for variant/filter URLs, faceted URLs `noindex` or canonicalized, sitemap of products.
- Image alt text, fast LCP on product image, breadcrumbs (`BreadcrumbList`).
- Checkout keyboard accessible, labeled fields, clear errors, autocomplete attributes on address/payment fields.

## Definition of done
- Test-mode purchase end to end: browse → cart → checkout → pay → webhook → order paid → stock decremented → confirmation email.
- Failed payment, cancel and refund paths tested; duplicate webhook does not double-process.
- Tampered price in the request is ignored (tested).
- Lighthouse >= 90 on product and category pages; responsive checkout at 360 px.
