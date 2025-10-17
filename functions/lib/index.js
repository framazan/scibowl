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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAnswer = void 0;
const functions = __importStar(require("firebase-functions"));
const string_similarity_1 = __importDefault(require("string-similarity"));
const admin = __importStar(require("firebase-admin"));
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
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Use POST' });
        return;
    }
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
    const score = string_similarity_1.default.compareTwoStrings(ua, ca);
    const correct = exact || score >= 0.76;
    res.json({ correct, score, reason: correct ? undefined : `Similarity ${score.toFixed(2)}` });
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
