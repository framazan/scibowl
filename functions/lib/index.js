"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRoomMemberCount = exports.checkAnswerBonus = exports.checkAnswerMC = exports.cleanupIdleRooms = void 0;
const functions = __importStar(require("firebase-functions"));
const functionsV1 = __importStar(require("firebase-functions/v1"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const vertexai_1 = require("@google-cloud/vertexai");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Initialize Firebase Admin SDK once
try {
    admin.app();
}
catch {
    admin.initializeApp();
}
// Scheduled cleanup: delete multiplayer rooms idle for > 3 days
exports.cleanupIdleRooms = (0, scheduler_1.onSchedule)({ schedule: 'every 24 hours', timeZone: 'Etc/UTC' }, async (_event) => {
    const db = admin.database();
    const now = Date.now();
    const maxAgeMs = 3 * 24 * 60 * 60 * 1000; // 3 days
    const cutoff = now - maxAgeMs;
    const roomsSnap = await db.ref('mp/rooms').once('value');
    const rooms = roomsSnap.val() || {};
    const toDelete = [];
    for (const [id, v] of Object.entries(rooms)) {
        const last = Number((v && v.lastActiveAt) || v?.createdAt || 0);
        const status = v?.status;
        // Only delete if closed or idle regardless of open/closed? Requirement says 'no user interaction'. We'll treat strictly by lastActiveAt
        if (!last || last < cutoff)
            toDelete.push(id);
    }
    // Delete room subtree and related indexes
    const updates = {};
    for (const id of toDelete) {
        updates[`mp/rooms/${id}`] = null;
        updates[`mp/roomMembers/${id}`] = null;
        updates[`mp/roomMessages/${id}`] = null;
        updates[`mp/roomSettings/${id}`] = null;
        updates[`mp/roomAnswers/${id}`] = null;
        updates[`mp/roomBuzzes/${id}`] = null;
        updates[`mp/roomHistory/${id}`] = null;
    }
    // Also prune userRooms entries pointing to deleted rooms
    const usersSnap = await db.ref('mp/userRooms').once('value');
    const users = usersSnap.val() || {};
    for (const [uid, roomsMap] of Object.entries(users)) {
        for (const rid of Object.keys(roomsMap || {})) {
            if (toDelete.includes(rid)) {
                updates[`mp/userRooms/${uid}/${rid}`] = null;
            }
        }
    }
    if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
    }
});
exports.checkAnswerMC = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Use POST' });
        return;
    }
    // Enforce Firebase App Check for incoming requests
    if (!(await enforceAppCheck(req, res))) {
        return;
    }
    const { userAnswer, correctAnswer, question, choices } = req.body ?? {};
    if (typeof userAnswer !== 'string' || typeof correctAnswer !== 'string') {
        res.status(400).json({ error: 'userAnswer and correctAnswer are required strings' });
        return;
    }
    const ua = normalize(userAnswer);
    const ca = normalize(stripAnswerParentheticals(correctAnswer));
    const ch = Array.isArray(choices) ? choices.slice(0, 4) : [];
    // If clear exact/contains match, fast-pass
    if (ua && ca && (ua === ca || ua.includes(ca))) {
        res.json({ correct: true });
        return;
    }
    const location = process.env.GCLOUD_LOCATION || process.env.FUNCTIONS_REGION || 'us-central1';
    const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.PROJECT_ID || admin.app().options.projectId;
    if (!project) {
        const fallback = ua && ca && ua === ca;
        res.json({ correct: fallback, reason: 'project-id missing, used fallback heuristic' });
        return;
    }
    try {
        const vertexAI = new vertexai_1.VertexAI({ project, location });
        const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const template = loadTemplate('mc_check.tmpl', defaultMcTemplate());
        const choicesBlock = formatChoicesBlock(ch);
        const prompt = template
            .replace(/\{\{QUESTION\}\}/g, safeForTmpl(String(question ?? '')))
            .replace(/\{\{OFFICIAL_ANSWER\}\}/g, safeForTmpl(String(correctAnswer ?? '')))
            .replace(/\{\{STUDENT_ANSWER\}\}/g, safeForTmpl(String(userAnswer ?? '')))
            .replace(/\{\{CHOICES\}\}/g, choicesBlock);
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2000 }
        });
        const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let parsed = null;
        try {
            parsed = JSON.parse(extractJson(text));
        }
        catch (e) {
            parsed = safeJsonLike(text);
        }
        const correct = !!parsed?.correct;
        const reason = typeof parsed?.reason === 'string' ? parsed.reason : undefined;
        res.json({ correct, reason });
    }
    catch (err) {
        const fallback = ua && ca && (ua === ca);
        res.json({ correct: fallback, reason: 'LLM check failed; used fallback' });
    }
});
exports.checkAnswerBonus = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Use POST' });
        return;
    }
    // Enforce Firebase App Check for incoming requests
    if (!(await enforceAppCheck(req, res))) {
        return;
    }
    const { userAnswer, correctAnswer, question } = req.body ?? {};
    if (typeof userAnswer !== 'string' || typeof correctAnswer !== 'string') {
        res.status(400).json({ error: 'userAnswer and correctAnswer are required strings' });
        return;
    }
    const ua = normalize(userAnswer);
    const ca = normalize(stripAnswerParentheticals(correctAnswer));
    // Only allow exact (case-insensitive, normalized) match to skip LLM
    if (ua && ca && ua === ca) {
        res.json({ correct: true });
        return;
    }
    const location = process.env.GCLOUD_LOCATION || process.env.FUNCTIONS_REGION || 'us-central1';
    const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.PROJECT_ID || admin.app().options.projectId;
    if (!project) {
        const fallback = ua && ca && ua === ca;
        res.json({ correct: fallback, reason: 'project-id missing, used fallback heuristic' });
        return;
    }
    try {
        const vertexAI = new vertexai_1.VertexAI({ project, location });
        const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const template = loadTemplate('bonus_check.tmpl', defaultBonusTemplate());
        const prompt = template
            .replace(/\{\{QUESTION\}\}/g, safeForTmpl(String(question ?? '')))
            .replace(/\{\{OFFICIAL_ANSWER\}\}/g, safeForTmpl(String(correctAnswer ?? '')))
            .replace(/\{\{STUDENT_ANSWER\}\}/g, safeForTmpl(String(userAnswer ?? '')));
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2000 }
        });
        const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let parsed = null;
        try {
            parsed = JSON.parse(extractJson(text));
        }
        catch (e) {
            parsed = safeJsonLike(text);
        }
        const correct = !!parsed?.correct;
        const reason = typeof parsed?.reason === 'string' ? parsed.reason : undefined;
        res.json({ correct, reason });
    }
    catch (err) {
        const fallback = ua && ca && (ua === ca);
        res.json({ correct: fallback, reason: 'LLM check failed; used fallback' });
    }
});
// Keep an accurate memberCount on mp/rooms/{roomId} regardless of RTDB read rules (1st gen trigger to avoid Eventarc perms)
exports.updateRoomMemberCount = functionsV1.database
    .ref('/mp/roomMembers/{roomId}/{uid}')
    .onWrite(async (_change, context) => {
    try {
        const roomId = context.params.roomId;
        const db = admin.database();
        const snap = await db.ref(`mp/roomMembers/${roomId}`).once('value');
        const val = snap.val() || {};
        const count = Object.keys(val).length;
        await db.ref(`mp/rooms/${roomId}/memberCount`).set(count);
    }
    catch (e) {
        // best-effort; ignore
    }
});
function stripAnswerParentheticals(ans) {
    // remove brackets/parentheses content commonly used in answerlines
    return ans.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
}
function normalize(s) {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9\s.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function extractJson(s) {
    // Attempt to find the first JSON object in the string
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start)
        return s.slice(start, end + 1);
    return s;
}
function safeJsonLike(s) {
    try {
        return JSON.parse(s);
    }
    catch { }
    // Very small adapter: replace single quotes and remove code fences
    const cleaned = s.replace(/^```[a-zA-Z]*\n?|```$/g, '').replace(/'/g, '"');
    try {
        return JSON.parse(cleaned);
    }
    catch {
        return null;
    }
}
function safeForTmpl(s) {
    return s.replace(/[{}]/g, '');
}
function loadTemplate(name, fallback) {
    try {
        const filePath = path.join(__dirname, 'prompts', name);
        return fs.readFileSync(filePath, 'utf8');
    }
    catch {
        return fallback;
    }
}
// Set CORS headers consistently for every request/response path
function setCorsHeaders(req, res) {
    const origin = req?.headers?.origin || '*';
    res.set('Access-Control-Allow-Origin', origin);
    // Ensure caches/proxies differentiate by Origin
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Max-Age', '3600');
}
function formatChoicesBlock(choices) {
    // Expect choices like [["w","text"], ...] or objects
    const pairs = [];
    const norm = (x) => String(x ?? '');
    for (const c of choices) {
        if (Array.isArray(c) && c.length >= 2) {
            pairs.push([norm(c[0]).toUpperCase(), norm(c[1])]);
        }
        else if (c && typeof c === 'object') {
            const key = (c.key ?? c.letter ?? c.label ?? c.k ?? c.id ?? '').toString().toUpperCase();
            const text = (c.text ?? c.value ?? c.option ?? c.answer ?? c.content ?? c.label ?? '').toString();
            if (key && text)
                pairs.push([key, text]);
        }
    }
    if (!pairs.length)
        return '';
    return pairs.map(([k, v]) => `${k}) ${v}`).join('\n');
}
function defaultMcTemplate() {
    return [
        'You are grading a Science Bowl multiple-choice response. The student may enter a letter (W/X/Y/Z/A/B/C/D) or the choice text.',
        'Return ONLY JSON: {"correct": true|false, "reason": string}.',
        'Use the official answer and choices to determine correctness. Minor spelling errors are allowed.',
        '',
        'Question: {{QUESTION}}',
        'Choices:\n{{CHOICES}}',
        'Official answer (may be a letter or text): {{OFFICIAL_ANSWER}}',
        'Student answer: {{STUDENT_ANSWER}}',
        '',
        'Reply ONLY with JSON.'
    ].join('\n');
}
function defaultBonusTemplate() {
    return [
        'You are grading a Science Bowl bonus response (short-answer). Bonuses may allow brief phrasing variants; assess conceptual correctness.',
        'Return ONLY JSON: {"correct": true|false, "reason": string}.',
        'Consider equivalent terms, units, and common synonyms; minor spelling errors are acceptable.',
        '',
        'Question: {{QUESTION}}',
        'Official answer: {{OFFICIAL_ANSWER}}',
        'Student answer: {{STUDENT_ANSWER}}',
        '',
        'Reply ONLY with JSON.'
    ].join('\n');
}
// Middleware-like helper to enforce Firebase App Check on HTTPS requests
async function enforceAppCheck(req, res) {
    try {
        // Ensure CORS headers are present even on auth errors
        setCorsHeaders(req, res);
        const headerName = 'x-firebase-appcheck';
        const token = req.header(headerName) || req.header(headerName.toUpperCase()) || '';
        if (!token) {
            res.status(401).json({ error: 'App Check token missing' });
            return false;
        }
        await admin.appCheck().verifyToken(token);
        return true;
    }
    catch (err) {
        setCorsHeaders(req, res);
        res.status(401).json({ error: 'Invalid App Check token' });
        return false;
    }
}
