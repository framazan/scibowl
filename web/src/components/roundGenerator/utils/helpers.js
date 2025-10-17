// Shared utility helpers extracted from RoundGenerator
import React from 'react';

export function unique(arr) { return Array.from(new Set(arr)); }

export function findBonus(tossup, all) {
  if (!tossup) return null;
  return all.find(q => q.question_type?.toLowerCase() === 'bonus' &&
    q.round === tossup.round &&
    q.tournament === tossup.tournament &&
    q.question_number === tossup.question_number);
}

// Parse multiple choice style answers from various source shapes
export function parseMCChoices(q) {
  if (!q) return [];
  const order = ['w', 'x', 'y', 'z'];
  const cleanKey = (k) => {
    if (k == null) return null;
    const c = String(k).replace(/[.)\s]/g, '').toLowerCase();
    const first = c[0];
    return order.includes(first) ? first : null;
  };
  const textOf = (v) => {
    if (v == null) return null;
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      return v.text ?? v.value ?? v.choice ?? v.content ?? v.answer ?? v.option ?? v.label ?? v.name ?? null;
    }
    return null;
  };
  let raw = q.choices ?? null;
  if (!raw) {
    const top = { w: q.w ?? q.W, x: q.x ?? q.X, y: q.y ?? q.Y, z: q.z ?? q.Z };
    if (Object.values(top).some(v => v != null && String(v).trim() !== '')) {
      raw = top;
    } else {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    const pairs = raw.slice(0, 4).map((item, idx) => {
      const t = textOf(item);
      return t ? [order[idx], t] : null;
    }).filter(Boolean);
    const byKey = new Map(pairs);
    return order.map(k => [k, byKey.get(k)]).filter(([, v]) => v != null);
  }
  if (raw && typeof raw === 'object') {
    const entries = Object.entries(raw).map(([k, v]) => {
      const t = textOf(v);
      const ck = cleanKey(k);
      if (!t || !ck) return null;
      return [ck, t];
    }).filter(Boolean);
    const byKey = new Map(entries);
    return order.map(k => [k, byKey.get(k)]).filter(([, v]) => v != null);
  }
  return [];
}

export function categoryToCode(cat) {
  if (!cat) return '';
  const c = String(cat).toUpperCase();
  if (c.startsWith('PHYS')) return 'P';
  if (c.startsWith('CHEM')) return 'C';
  if (c.startsWith('BIO')) return 'B';
  if (c.startsWith('MATH')) return 'M';
  if (c.startsWith('EARTH')) return 'E';
  if (c.startsWith('ASTRO')) return 'A';
  if (c.startsWith('ENERG')) return 'EN';
  if (c.startsWith('GEN')) return 'G';
  return c[0];
}

// Dynamically load html2pdf once
export async function loadHtml2Pdf() {
  if (typeof window !== 'undefined' && window.html2pdf) return window.html2pdf;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-html2pdf]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load html2pdf.js')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
    s.async = true;
    s.defer = true;
    s.setAttribute('data-html2pdf', 'true');
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load html2pdf.js'));
    document.head.appendChild(s);
  });
  return window.html2pdf;
}
