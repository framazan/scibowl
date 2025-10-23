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
exports.checkAnswer = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const vertexai_1 = require("@google-cloud/vertexai");
// Initialize Firebase Admin SDK once
try {
    admin.app();
}
catch {
    admin.initializeApp();
}
exports.checkAnswer = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Use POST' });
        return;
    }
    const { userAnswer, correctAnswer, question } = req.body ?? {};
    if (typeof userAnswer !== 'string' || typeof correctAnswer !== 'string') {
        res.status(400).json({ error: 'userAnswer and correctAnswer are required strings' });
        return;
    }
    const log = functions.logger;
    const safeTrunc = (s, n = 160) => {
        const t = String(s ?? '');
        return t.length > n ? t.slice(0, n) + '…' : t;
    };
    const ua = normalize(userAnswer);
    const ca = normalize(stripAnswerParentheticals(correctAnswer));
    log.info('checkAnswer:start', {
        method: req.method,
        uaLen: userAnswer?.length ?? 0,
        caLen: correctAnswer?.length ?? 0,
        hasQuestion: !!question,
        uaSample: safeTrunc(userAnswer, 80),
        caSample: safeTrunc(correctAnswer, 80),
    });
    // Fast exact/contains heuristics first to save LLM calls on obvious matches
    if (ua && ca && (ua === ca || ca.includes(ua) || ua.includes(ca))) {
        log.info('checkAnswer:fast-pass', { reason: 'exact-or-contains' });
        res.json({ correct: true, score: 1.0 });
        return;
    }
    // Use Vertex AI Gemini 2.5 Flash via service account (no API key exposed)
    const location = process.env.GCLOUD_LOCATION || process.env.FUNCTIONS_REGION || 'us-central1';
    const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.PROJECT_ID || admin.app().options.projectId;
    log.info('checkAnswer:env', {
        projectResolved: !!project,
        project,
        location,
        envKeys: Object.keys(process.env || {}).filter(k => ['GCLOUD_LOCATION', 'FUNCTIONS_REGION', 'GCLOUD_PROJECT', 'GCP_PROJECT', 'PROJECT_ID'].includes(k)),
    });
    if (!project) {
        // Fallback if project is not detected; still return heuristic
        const fallback = ua && ca && ua === ca;
        log.warn('checkAnswer:missing-projectid', { fallback });
        res.json({ correct: fallback, reason: 'project-id missing, used fallback heuristic' });
        return;
    }
    try {
        const vertexAI = new vertexai_1.VertexAI({ project, location });
        const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        log.info('checkAnswer:invoke-llm', { model: 'gemini-2.5-flash', project, location });
        const system = [
            'You are grading a Science Bowl short-answer or multiple-choice response.',
            'Return a strict JSON object: {"correct": true|false, "reason": string}.',
            'Consider equivalent scientific names, common abbreviations, and minor spelling errors.',
            'Do not require exact phrasing if the meaning is clearly correct.',
            'If the correct answer contains parenthetical clarifications, they are optional unless essential to meaning.',
        ].join('\n');
        const prompt = [
            system,
            '',
            question ? `Question: ${String(question).slice(0, 4000)}` : '',
            `Official answer: ${correctAnswer}`,
            `Student answer: ${userAnswer}`,
            '',
            'Reply ONLY with JSON, no markdown, no code fences.',
        ].join('\n');
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 128,
            }
        });
        // Extract text
        const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        log.info('checkAnswer:llm-response', {
            textLen: text?.length ?? 0,
            textSample: safeTrunc(text, 200),
            hasCandidates: !!result.response?.candidates?.length,
        });
        let parsed = null;
        try {
            parsed = JSON.parse(extractJson(text));
            log.info('checkAnswer:parse-success', { hasReason: typeof parsed?.reason === 'string', correct: !!parsed?.correct });
        }
        catch {
            // if model didn't return pure JSON, attempt a lenient parse
            parsed = safeJsonLike(text);
            if (parsed) {
                log.info('checkAnswer:parse-lenient-success', { hasReason: typeof parsed?.reason === 'string', correct: !!parsed?.correct });
            }
            else {
                log.warn('checkAnswer:parse-failed');
            }
        }
        const correct = !!parsed?.correct;
        const reason = typeof parsed?.reason === 'string' ? parsed.reason : undefined;
        res.json({ correct, reason });
    }
    catch (err) {
        // On failure, fall back to a conservative heuristic
        const fallback = ua && ca && (ua === ca);
        log.error('checkAnswer:llm-error', { message: err?.message, code: err?.code, name: err?.name, stack: err?.stack });
        res.json({ correct: fallback, reason: 'LLM check failed; used fallback' });
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
