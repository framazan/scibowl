# Google AdSense Integration Notes - NOT DEPLOYED, POTENTIAL INTEGRATION IN 2026

Global script + meta tag added in `index.html`.

To display ads you still need to:
1. Log into AdSense and create ad units. Copy each data-ad-slot value.
2. Uncomment the `AdSlot` import and usage in components (e.g. `App.jsx`) and provide the correct `slot` prop.
3. Deploy and wait for review/fill (new sites can take time to serve real ads).

Example usage:
```jsx
import AdSlot from './components/AdSlot.jsx';
<AdSlot slot="YOUR_SLOT_ID" />
```

For in-article style ads (automatic fluid width):
```jsx
<AdSlot slot="YOUR_SLOT_ID" format="auto" responsive />
```

## Consent / Privacy
If serving users in regions requiring consent (GDPR/EEA, CPRA), integrate a CMP and only load or enable ads after user consent. For stricter control you could:
- Remove the script from `index.html` and inject it dynamically after consent.
- Or use a blocking consent mode configuration via `gtag('consent', 'default', {...})` prior to ad load.

## Performance Tips
- Ads can shift layout. Reserve space to avoid CLS (e.g., wrapper with min-height approximating ad size if using fixed slots like 300x250).
- Avoid placing too many ad units on first paint.
- Monitor Core Web Vitals after enabling.

## Troubleshooting
- Blank space: often due to new site review, policy, or ad blocker.
- Console errors about `adsbygoogle.push()`: ensure script loaded once; avoid server-side rendering duplication.

