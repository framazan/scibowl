import React from 'react';
import LatexRenderer from '../../LatexRenderer.jsx';
import { parseMCChoices } from '../utils/helpers.js';
import { getVisualBonusUrl } from '../../../data/visualBonuses.js';

export default function RoundPdfContent({ displayPairs, QUESTIONS_PER_PAGE = 2, pdfRef }) {
  const [visuals, setVisuals] = React.useState({});
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      for (let i = 0; i < displayPairs.length; i++) {
        const b = displayPairs[i]?.bonus;
        if (!b) continue;
        const flagged = (b.is_visual_bonus === true || String(b.visual || '').toLowerCase() === 'true');
        if (!flagged) continue;
        try {
          const url = await getVisualBonusUrl({ tournament: b.tournament, round: b.round, question_number: b.question_number });
          if (url) next[i] = url;
        } catch {}
      }
      if (!cancelled) setVisuals(next);
    })();
    return () => { cancelled = true; };
  }, [displayPairs]);
  return (
    <div aria-hidden="true" style={{ position: 'fixed', left: '-10000px', top: 0, width: 816, pointerEvents: 'none', opacity: 0, visibility: 'visible' }}>
      <div ref={pdfRef} className="pdf-root">
        <style>{`
          .pdf-root, .pdf-root * { box-sizing: border-box; }
          .html2pdf__page-break + .pdf-header { margin-top: 0 !important; }
          @page { margin: 12mm; }
          .pdf-root { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, 'Apple Color Emoji', 'Segoe UI Emoji'; color: #000; margin: 0; padding: 0; }
          .pdf-page { width: 720px; margin: 0 auto; padding: 2mm 4px 0 4px; }
          .pdf-page { page-break-after: always; }
          .pdf-page:last-child { page-break-after: auto; }
          .pdf-header { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 2mm; padding: 0 2px; }
          .pdf-q { page-break-inside: avoid; break-inside: avoid; margin-bottom: 4mm; }
          .pdf-hr { border: none; border-top: 1px solid #888; margin: 8px 0; }
          .pdf-meta { font-size: 11px; color: #333; margin-bottom: 2mm; }
          .pdf-title { font-weight: 600; margin-bottom: 2mm; }
          .pdf-body { white-space: pre-wrap; line-height: 1.4; word-break: break-word; overflow-wrap: anywhere; }
          .pdf-choices { margin: 2mm 0; break-inside: avoid; }
          .pdf-choice { display: flex; align-items: flex-start; gap: 4px; line-height: 1.35; }
          .pdf-choice-key { font-weight: 600; width: 16px; flex: 0 0 auto; }
          .pdf-choice-val { flex: 1; }
          .pdf-ans { font-size: 12px; margin-top: 2mm; }
          .pdf-footer { text-align: center; font-size: 12px; color: #888; margin-top: 2mm; }
          .katex-display { margin: 0; }
        `}</style>
        {(() => {
          const groups = [];
          for (let i = 0; i < displayPairs.length; i += QUESTIONS_PER_PAGE) {
            const slice = displayPairs.slice(i, i + QUESTIONS_PER_PAGE);
            if (slice.length > 0) groups.push(slice);
          }
          const today = new Date().toLocaleDateString();
          const website = 'scibowl.app';
          return groups.map((group, gi) => {
            const base = gi * QUESTIONS_PER_PAGE;
            const pageNum = gi + 1;
            return (
              <div key={`pdf-group-${gi}`} className="pdf-page">
                <div className="pdf-header">{website} &mdash; {today}</div>
                {group.map((pair, idx) => {
                  const globalIndex = base + idx;
                  const tuChoices = pair.tossup ? parseMCChoices(pair.tossup) : [];
                  const boChoices = pair.bonus ? parseMCChoices(pair.bonus) : [];
                  return (
                    <React.Fragment key={`pdf-${globalIndex}`}>
                      <div className="pdf-q">
                        {pair.tossup && (
                          <div>
                            <div className="pdf-meta">{pair.tossup.tournament} • Round {pair.tossup.round ?? '—'} • {pair.tossup.category}{pair.tossup.question_number != null ? ` • Q${pair.tossup.question_number}` : ''}
                              <span style={tuChoices.length > 0 ? tagStyle('mc') : tagStyle('sa')}>
                                {tuChoices.length > 0 ? 'MULTIPLE CHOICE' : 'SHORT ANSWER'}
                              </span>
                            </div>
                            <div className="pdf-title">Toss-up {globalIndex + 1}</div>
                            <div className="pdf-body"><LatexRenderer>{pair.tossup.question}</LatexRenderer></div>
                            {tuChoices.length > 0 && (
                              <div className="pdf-choices">
                                {tuChoices.map(([k, v]) => (
                                  <div key={k} className="pdf-choice">
                                    <span className="pdf-choice-key">{k.toUpperCase()})</span>
                                    <span className="pdf-choice-val"><LatexRenderer>{v}</LatexRenderer></span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="pdf-ans"><span style={{opacity:0.7}}>Answer:</span> <LatexRenderer>{pair.tossup.answer}</LatexRenderer></div>
                          </div>
                        )}
                        {pair.bonus && (
                          <div style={{marginTop: pair.tossup ? '6mm' : 0, paddingTop: pair.tossup ? '2mm' : 0, borderTop: pair.tossup ? '1px solid #ddd' : 'none'}}>
                            <div className="pdf-meta">{(pair.tossup ? pair.tossup.tournament : pair.bonus.tournament)} • Round {pair.bonus.round ?? '—'} • {pair.bonus.category}{pair.bonus.question_number != null ? ` • Q${pair.bonus.question_number}` : ''}
                              <span style={boChoices.length > 0 ? tagStyle('mc') : tagStyle('sa')}>
                                {boChoices.length > 0 ? 'MULTIPLE CHOICE' : 'SHORT ANSWER'}
                              </span>
                            </div>
                            <div className="pdf-title">Bonus {globalIndex + 1}</div>
                            {visuals[globalIndex] && (
                              <div className="pdf-body" style={{marginBottom: '2mm'}}>
                                <img src={visuals[globalIndex]} alt="Visual bonus" style={{maxHeight: 220, width: '100%', objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 6}} />
                              </div>
                            )}
                            <div className="pdf-body"><LatexRenderer>{pair.bonus.question}</LatexRenderer></div>
                            {boChoices.length > 0 && (
                              <div className="pdf-choices">
                                {boChoices.map(([k, v]) => (
                                  <div key={k} className="pdf-choice">
                                    <span className="pdf-choice-key">{k.toUpperCase()})</span>
                                    <span className="pdf-choice-val"><LatexRenderer>{v}</LatexRenderer></span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="pdf-ans"><span style={{opacity:0.7}}>Answer:</span> <LatexRenderer>{pair.bonus.answer}</LatexRenderer></div>
                          </div>
                        )}
                      </div>
                      {idx < group.length - 1 && <hr className="pdf-hr" />}
                    </React.Fragment>
                  );
                })}
                <div className="pdf-footer">Page {pageNum} of {groups.length}</div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

function tagStyle(kind) {
  if (kind === 'mc') return {marginLeft: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 9999, padding: '1px 6px', fontSize: 10, fontWeight: 600};
  return {marginLeft: 6, border: '1px solid #e9d5ff', background: '#faf5ff', color: '#6b21a8', borderRadius: 9999, padding: '1px 6px', fontSize: 10, fontWeight: 600};
}
