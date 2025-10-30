import React, { useEffect, useRef } from 'react';
// ADSENSE IS NOT ACTIVE, POTENTIAL INTEGRATION IN 2026
/**
 * AdSlot renders a Google AdSense ad unit. Make sure the global script is in index.html.
 * Props:
 *  - slot: required ad slot id (string) from AdSense UI
 *  - format: "auto" (default) or other supported format
 *  - responsive: boolean (when true sets data-full-width-responsive="true")
 *  - className: optional wrapper classes
 */
export default function AdSlot({ slot, format = 'auto', responsive = true, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    let canceled = false;
    function push() {
      if (window.adsbygoogle && !canceled) {
        try { window.adsbygoogle.push({}); } catch (e) { /* ignore */ }
      }
    }
    // delay a tick to ensure script loaded
    const id = setTimeout(push, 50);
    return () => { canceled = true; clearTimeout(id); };
  }, []);

  return (
    <div className={className}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-7585878218149059"
        data-ad-slot={slot}
        data-ad-format={format}
        {...(responsive ? { 'data-full-width-responsive': 'true' } : {})}
      />
    </div>
  );
}
