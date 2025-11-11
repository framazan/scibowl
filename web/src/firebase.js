import { initializeApp, getApps } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider, getToken as getAppCheckTokenInternal } from 'firebase/app-check';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};


let app;
export function getFirebaseApp() {
  if (!getApps().length) {
    app = initializeApp(config);
  } else {
    app = getApps()[0];
  }
  return app;
}


export function getFirestoreDb() {
  ensureAppCheck();
  return getFirestore(getFirebaseApp());
}


export function getFirebaseAuth() {
  ensureAppCheck();
  return getAuth(getFirebaseApp());
}


export function getFirebaseStorage() {
  ensureAppCheck();
  return getStorage(getFirebaseApp());
}

// Initialize Firebase App Check (ReCaptcha v3) once; token auto-refresh enabled
let appCheckInstance = null;
export function ensureAppCheck() {
  try {
    // Enable debug token for local development if env variable is set
    if (import.meta.env.MODE === 'development' || window.FIREBASE_APPCHECK_DEBUG_TOKEN === 'true') {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    const app = getFirebaseApp();
    if (!appCheckInstance) {
      const entKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
      const v3Key = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY;
      if (entKey) {
        appCheckInstance = initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(entKey),
          isTokenAutoRefreshEnabled: true,
        });
      } else if (v3Key) {
        appCheckInstance = initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(v3Key),
          isTokenAutoRefreshEnabled: true,
        });
      } else {
        appCheckInstance = null;
      }
    }
    return appCheckInstance;
  } catch {
    return null;
  }
}

// Helper to retrieve an App Check token (or null if unavailable)
export async function getAppCheckToken(forceRefresh = false) {
  try {
    const ac = ensureAppCheck();
    if (!ac) return null;
    const res = await getAppCheckTokenInternal(ac, forceRefresh);
    return res?.token || null;
  } catch {
    return null;
  }
}
