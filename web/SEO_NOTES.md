# SEO & PWA Notes

Replace https://sciencebowl.org with your production domain (custom Firebase Hosting domain or mapped custom domain):

Files to update:
- `public/robots.txt` (Sitemap line)
- `public/sitemap.xml` (<loc> values)
- `index.html` (canonical, OG URL, image URL, JSON-LD)
- `src/components/SEO.jsx` (canonical links)

## Expanding the sitemap
Add future routes by inserting additional <url> blocks with loc, changefreq, priority.

If you add dynamic content pages (e.g. /tournament/:id), consider generating sitemap dynamically via a Cloud Function that queries Firestore and returns XML with correct Content-Type.

## Blocking sign-in
Currently robots.txt disallows /signin and SignInSEO sets noindex. Keep that to avoid low-value page indexing.

## Meta / Structured Data
Basic WebApplication schema added. You can expand with potentialAction entries (SearchAction) or documentation linking.

## Performance / Lighthouse
After deploying run Lighthouse. Ensure largest contentful paint is optimized (consider preloading critical font or using font-display swap). Consider adding <link rel="preconnect" to firebase domains if needed.

## Deployment Steps
1. Replace domains.
2. Run npm install in web to add react-helmet-async.
3. Build and deploy: npm run build && firebase deploy --only hosting

## Future Ideas
- Add analytics (GA4 or privacy-friendly) and use gtag.js with consent mode.
- Generate PDF round pages with indexable HTML if you want search traffic for practice questions (ensure permission to display content publicly).
- Add FAQ page and About page for semantic content; link them in header/footer; add to sitemap.

