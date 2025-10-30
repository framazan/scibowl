import React from 'react';
import TabbedHeader from './TabbedHeader.jsx';

export default function Layout({ children, auth }) {
  return (
    <>
      <TabbedHeader auth={auth} />
      <main className="w-full px-4 pb-8 app-main text-black dark:text-white">
        {children}
      </main>
      <footer className="w-full px-4 pb-8 text-center text-black/60 dark:text-white/60">
        <div className="space-y-2">
          <div>Built with Firebase • Vite • Tailwind</div>
          <div className="text-xs flex flex-wrap gap-2 justify-center" aria-label="Legal and policy links">
            <a href="/terms-of-service" className="hover:underline focus:outline-none focus:ring-1 focus:ring-current" rel="nofollow">Terms of Service</a>
            <span aria-hidden="true">•</span>
            <a href="/privacy-policy" className="hover:underline focus:outline-none focus:ring-1 focus:ring-current" rel="nofollow">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </>
  );
}