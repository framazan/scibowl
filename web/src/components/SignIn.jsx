import React from 'react';
import { SignInSEO } from './SEO.jsx';
import useAuth from '../data/useAuth';
import { getFirebaseAuth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import MuiThemeSwitch from './MuiThemeSwitch.jsx';
import { determineDark, loadThemePreference, saveThemePreference, subscribeToSystemTheme } from '../data/theme.js';

// Stable shell wrapper component (defined at module scope to avoid remounting on each render)
function Shell({ children, dark, setDark, themePref, setThemePref, userChangedPrefRef }) {
  return (
    <div className="min-h-screen app-radial-bg dark:app-radial-bg transition-colors glass-backdrop text-black dark:text-white flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md flex items-center justify-between mb-4 gap-2">
        <Link to="/round-generator" className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-black/10 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10 transition" aria-label="Back to home">
          <span aria-hidden="true" className="-ml-0.5 mr-0.5">←</span>
          <Home size={14} aria-hidden="true" />
          <span>Home</span>
        </Link>
        <div className="relative inline-flex items-center group">
          {themePref !== 'system' && (
            <button
              type="button"
              onClick={() => {
                userChangedPrefRef.current = true;
                setThemePref('system');
                setDark(determineDark('system'));
              }}
              className="mr-2 hidden group-hover:inline-flex items-center px-2 py-1 rounded text-xs border border-black/10 dark:border-white/20 bg-white/70 dark:bg-black/40 backdrop-blur-sm text-black dark:text-white hover:bg-white/90 dark:hover:bg-black/60 transition"
              aria-label="Follow system theme"
              title="Follow system"
            >
              Follow system
            </button>
          )}
          <MuiThemeSwitch
            checked={dark}
            onChange={(next) => {
              // Manual toggle = explicit user preference (stop following system)
              userChangedPrefRef.current = true;
              setThemePref(next ? 'dark' : 'light');
              setDark(next);
            }}
          />
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SignIn() {
  const auth = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [resetMode, setResetMode] = React.useState(false);
  const [resetMsg, setResetMsg] = React.useState('');
  // Theme preference: 'system' | 'light' | 'dark'
  const [themePref, setThemePref] = React.useState('system');
  const [dark, setDark] = React.useState(() => {
    try { return document.documentElement.classList.contains('dark'); }
    catch { return determineDark('system'); }
  });
  // Track if user explicitly changed theme; avoids persisting defaults on first load
  const userChangedPrefRef = React.useRef(false);

  // Load saved preference on mount; default to system otherwise
  React.useEffect(() => {
    let mounted = true;
    loadThemePreference().then((pref) => {
      if (!mounted) return;
      setThemePref(pref);
      setDark(determineDark(pref));
    });
    return () => { mounted = false; };
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    if (dark) {
      document.body.classList.add('dark-bg');
    } else {
      document.body.classList.remove('dark-bg');
    }
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', dark ? '#000000' : '#ffffff');
  }, [dark]);

  // Persist preference whenever it changes
  React.useEffect(() => {
    if (userChangedPrefRef.current) {
      saveThemePreference(themePref);
    }
  }, [themePref]);

  // When following system, subscribe to system theme changes and reflect immediately
  React.useEffect(() => {
    if (themePref !== 'system') return; // only follow system when set to system
    // Ensure initial sync to current system setting
    setDark(determineDark('system'));
    const unsubscribe = subscribeToSystemTheme((isDark) => {
      setDark(!!isDark);
    });
    return () => unsubscribe && unsubscribe();
  }, [themePref]);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const validPassword = password.length >= 10;

  const handleLoginEmail = async () => {
    setError('');
    if (!validEmail) { setError('Enter a valid email.'); return; }
    if (!validPassword) { setError('Password must be at least 10 characters.'); return; }
    setBusy(true);
    try {
      await auth.loginWithEmail(email, password);
    } catch (e) {
      const code = e?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Wrong email or password.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Try again later.');
      } else if (code === 'auth/invalid-email') {
        setError('Enter a valid email.');
      } else {
        setError(e?.message || 'Login failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignupEmail = async () => {
    setError('');
    if (!validEmail) { setError('Enter a valid email.'); return; }
    if (!validPassword) { setError('Password isn’t safe. Use at least 10 characters.'); return; }
    setBusy(true);
    try {
      await auth.signupWithEmail(email, password);
    } catch (e) {
      const code = e?.code || '';
      if (code === 'auth/email-already-in-use') {
        setError('That email already exists. Try signing in.');
      } else if (code === 'auth/weak-password') {
        setError('Password isn’t safe. Use at least 10 characters.');
      } else if (code === 'auth/invalid-email') {
        setError('Enter a valid email.');
      } else {
        setError(e?.message || 'Sign up failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try { await auth.loginWithGoogle(); }
    catch (e) {
      const code = e?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setError('Sign-in was canceled.');
      } else if (code === 'auth/cancelled-popup-request') {
        setError('Another sign-in is already in progress.');
      } else {
        setError(e?.message || 'Google sign-in failed.');
      }
    }
    finally { setBusy(false); }
  };

  if (auth.user) {
    return (
      <Shell dark={dark} setDark={setDark} themePref={themePref} setThemePref={setThemePref} userChangedPrefRef={userChangedPrefRef}>
      <div className="mx-auto w-full max-w-md p-6 glass space-y-4">
        <div className="mb-3">You’re signed in as <strong>{auth.user.email || auth.user.displayName}</strong>.</div>
        <div className="flex gap-2">
          <a href="/" className="btn btn-primary">Go to app</a>
          <button className="btn btn-ghost" onClick={auth.logout}>Logout</button>
        </div>
      </div>
      </Shell>
    );
  }

  // Password reset mode
  if (resetMode) {
    return (
      <Shell dark={dark} setDark={setDark} themePref={themePref} setThemePref={setThemePref} userChangedPrefRef={userChangedPrefRef}>
      <div className="mx-auto w-full max-w-md p-6 glass space-y-4 flex flex-col items-center">
        <h1 className="text-xl font-semibold gradient-text">Reset password</h1>
        {resetMsg && (
          <div className="rounded-lg border border-green-300/60 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200 dark:border-green-400/40 px-3 py-2 text-sm">{resetMsg}</div>
        )}
        {error && (
          <div className="rounded-lg border border-red-300/60 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 dark:border-red-400/40 px-3 py-2 text-sm">{error}</div>
        )}
        <input
          className="w-full rounded-lg border border-black/10 bg-white dark:bg-darkcard text-black dark:text-white px-2 py-2"
          placeholder="Enter your email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <div className="flex flex-col items-center gap-2 w-full mt-2">
          <button
            className="btn btn-primary flex items-center justify-center gap-2 w-full"
            disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)}
            onClick={async () => {
              setError('');
              setResetMsg('');
              setBusy(true);
              try {
                await sendPasswordResetEmail(getFirebaseAuth(), email);
                setResetMsg('Password reset email sent, if you have an account with us! Check your inbox.');
              } catch (e) {
                if (e?.code === 'auth/user-not-found') {
                  setError('No account found for that email.');
                } else if (e?.code === 'auth/invalid-email') {
                  setError('Enter a valid email.');
                } else {
                  setError(e?.message || 'Failed to send reset email.');
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
            Send reset email
          </button>
          <button className="btn btn-ghost flex items-center justify-center gap-2 w-full" onClick={() => { setResetMode(false); setError(''); setResetMsg(''); }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
        </div>
      </div>
      </Shell>
    );
  }

  return (
  <Shell dark={dark} setDark={setDark} themePref={themePref} setThemePref={setThemePref} userChangedPrefRef={userChangedPrefRef}>
    <div className="mx-auto w-full max-w-md p-6 glass mt-0 space-y-4 flex flex-col items-center">
    <SignInSEO />
      <h1 className="text-xl font-semibold gradient-text">Sign in</h1>
      {error && (
  <div className="rounded-lg border border-red-300/60 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 dark:border-red-400/40 px-3 py-2 text-sm" role="alert" aria-live="polite">
          {error}
        </div>
      )}
      <button
        className="btn btn-google w-full bg-white text-[#1f1f1f] border border-black/10 hover:bg-white/90 dark:bg-white dark:text-[#1f1f1f] dark:hover:bg-white/90 flex items-center justify-center text-base"
        style={{ maxWidth: 320, minHeight: 48, paddingTop: 8, paddingBottom: 8 }}
        disabled={busy}
        onClick={handleGoogle}
      >
        <span className="google-icon" style={{ width: 28, height: 28, marginRight: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden />
        <span style={{ lineHeight: '28px' }}>Sign in with Google</span>
      </button>
      <div className="text-center opacity-60 text-sm">or</div>
      <input
        className="w-full rounded-lg border border-black/10 bg-white dark:bg-darkcard text-black dark:text-white px-2 py-2"
        placeholder="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        className="w-full rounded-lg border border-black/10 bg-white dark:bg-darkcard text-black dark:text-white px-2 py-2"
        placeholder="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <div className="flex flex-col w-full mt-2 gap-2 items-center">
        <div className="flex gap-2 w-full justify-center">
          <button className="btn btn-fancy flex items-center justify-center gap-2 text-sm font-medium" disabled={busy} onClick={handleLoginEmail}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
            Login
          </button>
          <button className="btn btn-orange flex items-center justify-center gap-2 text-sm font-medium hover-lift" disabled={busy} onClick={handleSignupEmail}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Sign up
          </button>
        </div>
        <button
          className="text-xs text-red-500 hover:underline focus:underline font-normal w-full mt-2 flex items-center justify-center gap-1 bg-transparent border-none p-0"
          type="button"
          style={{ cursor: 'pointer' }}
          onClick={() => { setResetMode(true); setError(''); setResetMsg(''); }}
        >
          Forgot password?
        </button>
      </div>
    </div>
  </Shell>
  );
}
