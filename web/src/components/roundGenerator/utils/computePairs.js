import { findBonus } from './helpers.js';
import { isVisualBonus } from '../../../data/visualBonuses.js';

/**
 * Compute display pairs based on filters and state.
 * Inputs are passed explicitly to keep this pure and testable.
 */
export function computePairsUtil({
  validQuestions,
  selectedTournaments,
  inRanges,
  selectedCategories,
  selectedExcludeRoundIds,
  excludeDetailCache,
  count,
  questionType,
  allowVisualInPairs,
  allowVisualInBonusOnly,
  buildExcludeSetFromRound,
}) {
  // Build exclusion set from selected rounds
  const excludeSet = new Set();
  for (const id of selectedExcludeRoundIds || []) {
    const detail = excludeDetailCache?.current?.get(id);
    if (detail) {
      const s = buildExcludeSetFromRound(detail);
      for (const qid of s) excludeSet.add(qid);
    }
  }

  function balancedSample(all, desired) {
    if (all.length === 0 || desired <= 0) return [];
    const byCat = new Map();
    for (const q of all) {
      if (!byCat.has(q.category)) byCat.set(q.category, []);
      byCat.get(q.category).push(q);
    }
    let cats = Array.from(byCat.keys());
    if (selectedCategories && selectedCategories.length) {
      const setSel = new Set(selectedCategories);
      cats = cats.filter(c => setSel.has(c));
    }
    cats = cats.filter(c => (byCat.get(c)?.length || 0) > 0);
    if (cats.length === 0) return [];
    const shuffledCats = [...cats].sort(() => Math.random() - 0.5);
    const base = Math.floor(desired / shuffledCats.length);
    let remainder = desired % shuffledCats.length;
    const picks = [];
    const usedIds = new Set();
    for (let i = 0; i < shuffledCats.length; i++) {
      const cat = shuffledCats[i];
      const list = [...byCat.get(cat)].sort(() => Math.random() - 0.5);
      const need = Math.min(base + (remainder > 0 ? 1 : 0), list.length);
      if (remainder > 0) remainder--;
      for (let k = 0; k < need; k++) {
        const q = list[k];
        if (!usedIds.has(q.id)) { picks.push(q); usedIds.add(q.id); }
      }
    }
    if (picks.length < desired) {
      const leftovers = [];
      for (const cat of cats) {
        for (const q of byCat.get(cat)) if (!usedIds.has(q.id)) leftovers.push(q);
      }
      leftovers.sort(() => Math.random() - 0.5);
      for (const q of leftovers) {
        if (picks.length >= desired) break;
        picks.push(q); usedIds.add(q.id);
      }
    }
    return picks.slice(0, desired);
  }

  let pairs = [];
  const lowerQT = String(questionType || 'both').toLowerCase();
  if (lowerQT === 'tossup') {
    const pool = (validQuestions||[]).filter(q =>
      (selectedTournaments.length ? selectedTournaments.includes(q.tournament) : true) &&
      inRanges(q) &&
      String(q.question_type||'').toLowerCase() === 'tossup' &&
      !excludeSet.has(q.id)
    );
    const picks = pool.length <= count ? [...pool] : balancedSample(pool, count);
    for (let i = picks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [picks[i], picks[j]] = [picks[j], picks[i]]; }
    pairs = picks.map(tossup => ({ tossup, bonus: null }));
  } else if (lowerQT === 'bonus') {
    const pool = (validQuestions||[]).filter(q =>
      (selectedTournaments.length ? selectedTournaments.includes(q.tournament) : true) &&
      inRanges(q) &&
      String(q.question_type||'').toLowerCase() === 'bonus' &&
      (allowVisualInBonusOnly ? true : !isVisualBonus(q)) &&
      !excludeSet.has(q.id)
    );
    const picks = pool.length <= count ? [...pool] : balancedSample(pool, count);
    for (let i = picks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [picks[i], picks[j]] = [picks[j], picks[i]]; }
    pairs = picks.map(bonus => ({ tossup: null, bonus }));
  } else if (lowerQT === 'visual-bonus') {
    const pool = (validQuestions||[]).filter(q =>
      (selectedTournaments.length ? selectedTournaments.includes(q.tournament) : true) &&
      inRanges(q) &&
      String(q.question_type||'').toLowerCase() === 'bonus' &&
      isVisualBonus(q) &&
      !excludeSet.has(q.id)
    );
    const picks = pool.length <= count ? [...pool] : balancedSample(pool, count);
    for (let i = picks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [picks[i], picks[j]] = [picks[j], picks[i]]; }
    pairs = picks.map(bonus => ({ tossup: null, bonus }));
  } else {
    const tossupPoolRaw = (validQuestions||[]).filter(q =>
      (selectedTournaments.length ? selectedTournaments.includes(q.tournament) : true) &&
      inRanges(q) &&
      String(q.question_type||'').toLowerCase() === 'tossup' &&
      !excludeSet.has(q.id)
    );
    const tossupPool = tossupPoolRaw.filter(tu => {
      const bonus = findBonus(tu, validQuestions);
      if (!bonus) return false;
      if (excludeSet.has(bonus.id)) return false;
      if (!allowVisualInPairs && isVisualBonus(bonus)) return false;
      return true;
    });
    const tossupPicks = tossupPool.length <= count ? [...tossupPool] : balancedSample(tossupPool, count);
    for (let i = tossupPicks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tossupPicks[i], tossupPicks[j]] = [tossupPicks[j], tossupPicks[i]]; }
    pairs = tossupPicks.map(tossup => {
      const bonus = findBonus(tossup, validQuestions);
      const finalBonus = (bonus && (allowVisualInPairs || !isVisualBonus(bonus)) && !excludeSet.has(bonus.id)) ? bonus : null;
      return { tossup, bonus: finalBonus };
    });
  }
  return pairs;
}
