import { getAppCheckToken } from '../firebase.js';

// API Gateway host and key: use env if provided, else fallback to known values
const GATEWAY_HOST = import.meta.env.VITE_GATEWAY_HOST || 'vertex-gateway-7e74h6s4.uc.gateway.dev';
const API_KEY = import.meta.env.VITE_GW_API_KEY || 'AIzaSyBxfXewuANeaSgDisu5U4cD1JF70VJuP_U';

function buildUrl(path) {
  const base = `https://${GATEWAY_HOST}`;
  const clean = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(base + clean);
  url.searchParams.set('key', API_KEY);
  return url.toString();
}

export async function postJson(path, body) {
  const url = buildUrl(path);
  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = await getAppCheckToken();
    if (token) headers['X-Firebase-AppCheck'] = token;
  } catch {}
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  return res;
}

// Convenience wrappers for specific endpoints
export async function checkAnswerMC(payload) {
  return postJson('/checkAnswerMC', payload);
}
export async function checkAnswerBonus(payload) {
  return postJson('/checkAnswerBonus', payload);
}
