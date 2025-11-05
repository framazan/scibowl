import React from 'react';
import { Helmet } from 'react-helmet-async';

// Helper to compute canonical/absolute URLs without hard-coding a domain.
function getSiteUrl(pathname = '') {
  const envUrl = import.meta?.env?.VITE_SITE_URL;
  const base = (envUrl && typeof envUrl === 'string' && envUrl.trim()) || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) return pathname || '/';
  try {
    const url = new URL(pathname || '/', base);
    return url.toString();
  } catch {
    return base + (pathname || '/');
  }
}

// IMPORTANT: Helmet only accepts plain valid head elements as direct children.
// Avoid custom components inside <Helmet> to prevent warnOnInvalidChildren.

export function HomeSEO() {
  return (
    <Helmet>
      <title>atombowl — Science Bowl practice, multiplayer buzzer, and round generator</title>
      <meta name="description" content="atombowl brings Science Bowl prep together: practice mode, multiplayer rooms, real-time buzzer system, and a fast round generator with visual bonuses." />
      <link rel="canonical" href={getSiteUrl('/')} />
      <meta name="robots" content="index,follow" />
      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="atombowl" />
      <meta property="og:title" content="atombowl — Science Bowl practice, multiplayer, buzzer" />
      <meta property="og:description" content="Practice questions, generate rounds, and buzz together online — all in one place." />
      <meta property="og:url" content={getSiteUrl('/')} />
      <meta property="og:image" content={getSiteUrl('/logo.png')} />
      <meta property="og:image:alt" content="atombowl Logo" />
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="atombowl — Science Bowl practice, multiplayer, buzzer" />
      <meta name="twitter:description" content="Practice mode, multiplayer rooms, and a fast round generator." />
      <meta name="twitter:image" content={getSiteUrl('/logo.png')} />
    </Helmet>
  );
}

export function RoundGeneratorSEO() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: getSiteUrl('/')
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Round Generator',
        item: getSiteUrl('/round-generator')
      }
    ]
  };
  return (
    <Helmet>
      <title>Round Generator & Practice | atombowl</title>
      <meta name="description" content="Generate custom Science Bowl practice rounds instantly. Filter by tournament and category, include toss-ups and bonuses, and export to PDF." />
      <link rel="canonical" href={getSiteUrl('/round-generator')} />
      {/* OG/Twitter */}
      <meta property="og:title" content="Round Generator & Practice | atombowl" />
      <meta property="og:description" content="Build practice rounds from curated tournaments in seconds." />
      <meta property="og:url" content={getSiteUrl('/round-generator')} />
      <meta property="og:image" content={getSiteUrl('/logo.png')} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Round Generator & Practice | atombowl" />
      <meta name="twitter:description" content="Generate custom Science Bowl rounds instantly." />
      <meta name="twitter:image" content={getSiteUrl('/logo.png')} />
      <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
    </Helmet>
  );
}

export function PracticeSEO() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: getSiteUrl('/')
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Practice',
        item: getSiteUrl('/practice')
      }
    ]
  };
  return (
    <Helmet>
      <title>Practice Mode | atombowl</title>
      <meta name="description" content="Drill Science Bowl toss-ups and bonuses with keyboard shortcuts, instant feedback, and adjustable reading speed." />
      <link rel="canonical" href={getSiteUrl('/practice')} />
      <meta property="og:title" content="Practice Mode | atombowl" />
      <meta property="og:description" content="Practice Science Bowl questions with instant feedback." />
      <meta property="og:url" content={getSiteUrl('/practice')} />
      <meta property="og:image" content={getSiteUrl('/logo.png')} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Practice Mode | atombowl" />
      <meta name="twitter:description" content="Drill toss-ups and bonuses with smart helpers." />
      <meta name="twitter:image" content={getSiteUrl('/logo.png')} />
      <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
      <meta name="robots" content="follow" />
    </Helmet>
  );
}

export function SignInSEO() {
  return (
    <Helmet>
      <title>Sign In | atombowl</title>
      <meta name="robots" content="noindex,nofollow" />
      <meta name="description" content="Sign in to access atombowl features including practice mode, round generator, multiplayer rooms, and buzzer." />
      <link rel="canonical" href={getSiteUrl('/signin')} />
    </Helmet>
  );
}

export function MultiplayerSEO() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: getSiteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Multiplayer', item: getSiteUrl('/multiplayer') }
    ]
  };
  return (
    <Helmet>
      <title>Multiplayer Rooms | atombowl</title>
      <meta name="description" content="Create or join public and private rooms to practice Science Bowl live with a real-time buzzer and chat." />
      <link rel="canonical" href={getSiteUrl('/multiplayer')} />
      <meta property="og:title" content="Multiplayer Rooms | atombowl" />
      <meta property="og:description" content="Practice together online with live buzzing and chat." />
      <meta property="og:url" content={getSiteUrl('/multiplayer')} />
      <meta property="og:image" content={getSiteUrl('/logo.png')} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Multiplayer Rooms | atombowl" />
      <meta name="twitter:description" content="Host or join rooms for live buzzing practice." />
      <meta name="twitter:image" content={getSiteUrl('/logo.png')} />
      <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
    </Helmet>
  );
}

export function RoomSEO() {
  // For individual multiplayer room pages, avoid indexing ephemeral URLs.
  // Point canonical to the multiplayer landing while still allowing link discovery.
  return (
    <Helmet>
      <title>Multiplayer Room | atombowl</title>
      <meta name="robots" content="noindex,follow" />
      <link rel="canonical" href={getSiteUrl('/multiplayer')} />
      <meta name="description" content="Join a Science Bowl multiplayer room to practice live buzzing with friends and teammates." />
      <meta property="og:title" content="Multiplayer Room | atombowl" />
      <meta property="og:description" content="Practice together online with live buzzing and chat." />
      <meta property="og:url" content={getSiteUrl('/multiplayer')} />
      <meta property="og:image" content={getSiteUrl('/logo.png')} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Multiplayer Room | atombowl" />
      <meta name="twitter:description" content="Host or join rooms for live buzzing practice." />
      <meta name="twitter:image" content={getSiteUrl('/logo.png')} />
    </Helmet>
  );
}

export function BuzzerSEO() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: getSiteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Buzzer', item: getSiteUrl('/buzzer') }
    ]
  };
  return (
    <Helmet>
      <title>Buzzer | atombowl</title>
      <meta name="description" content="Simple, real-time Science Bowl buzzer. Host a room, share the code, and start buzzing instantly." />
      <link rel="canonical" href={getSiteUrl('/buzzer')} />
      <meta property="og:title" content="Buzzer | atombowl" />
      <meta property="og:description" content="Real-time online buzzer for scrims and practices." />
      <meta property="og:url" content={getSiteUrl('/buzzer')} />
      <meta property="og:image" content={getSiteUrl('/logo.png')} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Buzzer | atombowl" />
      <meta name="twitter:description" content="Share a code and buzz from any device." />
      <meta name="twitter:image" content={getSiteUrl('/logo.png')} />
      <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
    </Helmet>
  );
}
