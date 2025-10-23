import React from 'react';
import { Helmet } from 'react-helmet-async';

export function RoundGeneratorSEO() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://sciencebowl.org/'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Round Generator',
        item: 'https://sciencebowl.org/round-generator'
      }
    ]
  };
  return (
    <Helmet>
      <title>Round Generator & Practice | DA SciBowl</title>
      <meta name="description" content="Generate custom Science Bowl practice rounds instantly. Filter by tournament, practice toss-ups and bonuses, and prepare for competitions." />
      <link rel="canonical" href="https://sciencebowl.org/round-generator" />
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
        item: 'https://sciencebowl.org/'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Practice',
        item: 'https://sciencebowl.org/practice'
      }
    ]
  };
  return (
    <Helmet>
      <title>Science Bowl Practice Mode | Davidson Science Bowl</title>
      <meta name="description" content="Practice Science Bowl questions by selecting tournaments and generating custom practice sets." />
      <link rel="canonical" href="https://sciencebowl.org/practice" />
      <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
      <meta name="robots" content="follow" />
    </Helmet>
  );
}

export function SignInSEO() {
  return (
    <Helmet>
      <title>Sign In | Science Bowl Practice</title>
      <meta name="robots" content="noindex,nofollow" />
      <meta name="description" content="Sign in to access Science Bowl round generation and practice features." />
      <link rel="canonical" href="https://sciencebowl.org/signin" />
    </Helmet>
  );
}
