# SEO & PWA Notes

Canonical domain: https://sciencebowl.org

We intentionally keep all canonicals, sitemap URLs, and absolute references on sciencebowl.org (brand name is “atombowl”). Do not replace this domain unless there is a formal domain migration.

Key files referencing the canonical domain:
- `public/robots.txt` (Sitemap line)
- `public/sitemap.xml` (<loc> values)
- `index.html` (canonical, OG URL, image URL, JSON-LD)
- `src/components/SEO.jsx` (canonical links per route via Helmet)

## Expanding the sitemap
Add future routes by inserting additional <url> blocks with loc, changefreq, priority.

If you add dynamic content pages (e.g. /tournament/:id), consider generating sitemap dynamically via a Cloud Function that queries Firestore and returns XML with correct Content-Type.

## Blocking sign-in
Currently robots.txt disallows /signin and SignInSEO sets noindex. Keep that to avoid low-value page indexing.

## Meta / Structured Data
Basic WebApplication schema is added in `index.html`. Route-level structured data (BreadcrumbList) is added for key pages in `SEO.jsx` (home/rounds/practice/multiplayer/buzzer). You can expand with potentialAction entries (SearchAction) or documentation linking.

Helmet usage: Only include plain head elements directly inside `<Helmet>` (title, meta, link, script, noscript). Avoid custom React components as children of Helmet — they trigger `react-helmet-async` warnings.

## Performance / Lighthouse
After deploying run Lighthouse. Ensure largest contentful paint is optimized (consider preloading critical font or using font-display swap). Consider adding <link rel="preconnect" to firebase domains if needed.

## Deployment Steps
1. Verify sciencebowl.org remains the canonical domain in all locations.
2. Ensure `react-helmet-async` is installed and used (`HelmetProvider` in `main.jsx`).
3. Build and deploy: `npm run build` then `firebase deploy --only hosting`.

## Future Ideas
- Add analytics (GA4 or privacy-friendly) and use gtag.js with consent mode.
- Generate PDF round pages with indexable HTML if you want search traffic for practice questions (ensure permission to display content publicly).
- Add FAQ page and About page for semantic content; link them in header/footer; add to sitemap.

