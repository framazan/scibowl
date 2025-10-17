import * as functions from 'firebase-functions';
import similarity from 'string-similarity';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK once
try {
  admin.app();
} catch {
  admin.initializeApp();
}

export const checkAnswer = functions.https.onRequest(async (req, res): Promise<void> => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST' }); return; }

  const { userAnswer, correctAnswer } = req.body ?? {};
  if (typeof userAnswer !== 'string' || typeof correctAnswer !== 'string') {
  res.status(400).json({ error: 'userAnswer and correctAnswer are required strings' });
  return;
  }

  const ua = normalize(userAnswer);
  const ca = normalize(stripAnswerParentheticals(correctAnswer));

  // Fast exact / includes check
  const exact = ua === ca || ca.includes(ua) || ua.includes(ca);
  // Similarity
  const score = similarity.compareTwoStrings(ua, ca);
  const correct = exact || score >= 0.76;

  res.json({ correct, score, reason: correct ? undefined : `Similarity ${score.toFixed(2)}` });
});

function stripAnswerParentheticals(ans: string): string {
  // remove brackets/parentheses content commonly used in answerlines
  return ans.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
 
