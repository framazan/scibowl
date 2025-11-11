import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import MuiThemeSwitch from '../MuiThemeSwitch.jsx';
import useThemePreference from '../../hooks/useThemePreference.js';
import Loading from './Loading.jsx';

// Shared top navigation header with brand, tabs, slider, theme toggle, and optional auth cluster
// Props: { auth }
export default function TabbedHeader({ auth }) {
  const { themePref, setThemePref, dark, setDark } = useThemePreference();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [scrolled, setScrolled] = React.useState(false);

  // On home, reveal brand once the bottom of the hero logo reaches the bottom of the header; on other pages always show
  React.useEffect(() => {
    if (!isHome) { setScrolled(true); return; }
    const compute = () => {
      try {
        const logo = document.getElementById('home-logo');
        // Determine header height from ref or CSS var fallback
        let headerH = 0;
        if (headerRef.current) {
          headerH = Math.ceil(headerRef.current.getBoundingClientRect().height || 0);
        }
        if (!headerH) {
          const cssH = getComputedStyle(document.documentElement).getPropertyValue('--header-h');
          headerH = parseInt(cssH || '72', 10) || 72;
        }
        if (!logo) { setScrolled(window.scrollY > headerH); return; }
        const rect = logo.getBoundingClientRect();
        // Reveal when the bottom of the logo has reached the bottom edge of the header
        setScrolled(rect.bottom <= headerH);
      } catch {}
    };
    compute();
    window.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, [isHome]);

  // Derive active tab from pathname
  const tab = location.pathname === '/'
    ? 'home'
    : location.pathname.startsWith('/practice')
    ? 'practice'
    : location.pathname.startsWith('/admin')
    ? 'admin'
    : location.pathname.startsWith('/multiplayer')
    ? 'multiplayer'
    : location.pathname.startsWith('/buzzer')
    ? 'buzzer'
    : 'generate';

  // Determine if current user is admin
  const isAdmin = auth?.user?.uid === 'fkLJJ2R6HbdwqoXSxrLUybZ0IdH2';

  // Define tabs (append Admin as a tab for admin users only)
  const tabs = React.useMemo(() => {
    const base = [
      { key: 'home', label: 'Home', path: '/' },
      { key: 'practice', label: 'Practice', path: '/practice' },
      { key: 'generate', label: 'Round Generator', path: '/round-generator' },
      { key: 'multiplayer', label: 'Multiplayer', path: '/multiplayer' },
      { key: 'buzzer', label: 'Buzzer', path: '/buzzer' },
    ];
    if (isAdmin) base.push({ key: 'admin', label: 'Admin', path: '/admin' });
    return base;
  }, [isAdmin]);

  // Slider state and refs
  const [sliderStyle, setSliderStyle] = React.useState({ width: '0px', transform: 'translateX(0px)' });
  const tabRefs = React.useRef([]);
  const headerRef = React.useRef(null);
  React.useEffect(() => {
    const tabOrder = tabs.map(t => t.key);
    const activeIndex = tabOrder.indexOf(tab);
    const activeEl = activeIndex !== -1 ? tabRefs.current[activeIndex]?.current : null;
    if (activeEl && activeEl.parentElement) {
      const tabRect = activeEl.getBoundingClientRect();
      const navRect = activeEl.parentElement.getBoundingClientRect();
      setSliderStyle(prev => {
        const newStyle = {
          width: `${tabRect.width}px`,
          transform: `translateX(${tabRect.left - navRect.left}px)`,
        };
        if (prev.width === newStyle.width && prev.transform === newStyle.transform) return prev;
        return newStyle;
      });
    }
  }, [tab, location.pathname, tabs]);

  // Keep CSS --header-h in sync with actual header height
  React.useEffect(() => {
    const updateHeaderH = () => {
      try {
        if (!headerRef.current) return;
        const rect = headerRef.current.getBoundingClientRect();
        if (rect && rect.height) {
          const h = Math.ceil(rect.height);
          document.documentElement.style.setProperty('--header-h', `${h}px`);
        }
      } catch {}
    };
    updateHeaderH();
    const ro = 'ResizeObserver' in window ? new ResizeObserver(updateHeaderH) : null;
    if (ro && headerRef.current) ro.observe(headerRef.current);
    window.addEventListener('resize', updateHeaderH);
    return () => {
      window.removeEventListener('resize', updateHeaderH);
      if (ro) ro.disconnect();
    };
  }, [tab, dark]);

  return (
    <header ref={headerRef} className="header-bar" style={{ overflow: 'visible' }}>
      <div className="w-full px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between" style={{ position: 'relative', zIndex: 10 }}>
        <div
          className="brand-cluster flex items-center gap-2"
          style={{
            transition: 'opacity .35s ease, transform .35s ease',
            opacity: scrolled ? 1 : 0,
            transform: scrolled ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
            pointerEvents: scrolled ? 'auto' : 'none',
          }}
          aria-hidden={isHome && !scrolled}
        >
          <img src="/logo.png" alt="atombowl Logo" className="w-8 h-8 sm:w-9 sm:h-9" />
          {/* Full title on large screens */}
          <div className="font-semibold tracking-tight hidden lg:block text-[#121930] dark:text-white">atombowl</div>
          {/* Abbreviated on small/medium */}
          <div className="font-semibold tracking-tight hidden sm:block lg:hidden text-[#121930] dark:text-white">DSB</div>
          {/* No text on extra-small: logo only */}
        </div>
        <nav className="tabs flex items-center gap-2 relative overflow-x-auto whitespace-nowrap" style={{ position: 'relative' }}>
          {tabs.map((item, idx) => (
            <div
              key={item.path}
              ref={(el) => {
                // Ensure we have a stable ref object per index for slider measurements
                if (!tabRefs.current[idx]) tabRefs.current[idx] = { current: null };
                tabRefs.current[idx].current = el;
              }}
              className={`tab ${tab === item.key ? 'active' : ''}`}
              style={{
                padding: '16px 24px',
                cursor: 'pointer',
                textAlign: 'center',
                position: 'relative',
                zIndex: 11,
                textTransform: 'lowercase',
                color: tab === item.key
                  ? '#ffffff'
                  : (dark ? 'rgba(229, 231, 235, 0.9)' : '#1f2a44'),
                fontWeight: tab === item.key ? '600' : '500',
                background: tab === item.key
                  ? (dark
                      ? 'rgba(60, 80, 255, 0.35)'
                      : 'linear-gradient(135deg, rgba(59,130,246,0.92), rgba(99,102,241,0.9))')
                  : (dark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(17, 25, 40, 0.06)'),
                borderRadius: '16px',
                transition: 'background 0.3s, color 0.3s, box-shadow 0.3s',
                boxShadow: tab === item.key
                  ? (dark
                      ? '0 2px 12px -2px rgba(60,80,255,0.18)'
                      : '0 6px 18px -6px rgba(37, 99, 235, 0.45)')
                  : (dark
                      ? 'none'
                      : 'inset 0 0 0 1px rgba(17, 25, 40, 0.08)'),
              }}
              onClick={() => {
                // Toggle admin border visual when switching tabs
                try {
                  if (item.key === 'admin') {
                    document.body.classList.add('admin-border-on');
                    document.documentElement.classList.add('admin-border-on');
                  } else {
                    document.body.classList.remove('admin-border-on');
                    document.documentElement.classList.remove('admin-border-on');
                  }
                } catch {}
                navigate(item.path);
              }}
            >
              {item.label}
            </div>
          ))}
          <div
            className="slider"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: dark ? '4px' : '6px',
              background: dark
                ? 'linear-gradient(90deg,rgba(60,80,255,0.7),rgba(120,80,255,0.7))'
                : 'linear-gradient(90deg, #3b82f6, #a78bfa)',
              borderRadius: dark ? '2px' : '3px',
              boxShadow: dark
                ? '0 2px 8px rgba(60,80,255,0.18)'
                : '0 6px 18px -6px rgba(37, 99, 235, 0.5)',
              transition: 'transform 0.3s cubic-bezier(.4,0,.2,1), width 0.3s cubic-bezier(.4,0,.2,1)',
              zIndex: 10,
              ...sliderStyle,
            }}
          />

          {/* Admin button removed; Admin now appears as a tab for admin users only */}

          {/* Theme toggle cluster */}
          <div className="ml-2 sm:ml-4">
            <div className="relative inline-flex items-center group">
              {themePref !== 'system' && (
                <button
                  type="button"
                  onClick={() => { setThemePref('system'); }}
                  className="mr-2 hidden group-hover:inline-flex items-center px-2 py-1 rounded text-xs border border-black/10 dark:border-white/20 bg-white/70 dark:bg-black/40 backdrop-blur-sm text-black dark:text-white hover:bg-white/90 dark:hover:bg-black/60 transition"
                  aria-label="Follow system theme"
                  title="Follow system"
                >
                  Follow system
                </button>
              )}
              <MuiThemeSwitch
                checked={dark}
                onChange={(next) => setDark(next)}
              />
            </div>
          </div>

          {/* Auth cluster */}
          <div className="ml-2 sm:ml-3">
            {auth?.loading ? (
              <Loading className="text-sm opacity-70" />
            ) : auth?.user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm opacity-80 max-w-[12rem] truncate hidden md:inline">{auth.user.email || auth.user.displayName}</span>
                <button className="btn btn-top-maroon" onClick={auth.logout}>Logout</button>
              </div>
            ) : (
              <Link to="/signin" className="btn btn-primary hidden xs:inline-flex">Sign in</Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
