import React from 'react';

/**
 * CoachesScoresheet
 * Renders two parallel tables (Team A / Team B) using provided rows.
 * rows: Array of objects with shape from sheetRows in RoundGenerator.
 * players: full players array to show names (optional header usage later).
 */
export default function CoachesScoresheet({ rows = [], players = [] }) {
  const teamAPlayers = players.filter(p => p.team === 'A');
  const teamBPlayers = players.filter(p => p.team === 'B');
  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial', color: '#000', padding: 16 }}>
      <h1 style={{ textAlign: 'center', fontSize: 20, margin: '0 0 12px' }}>Coaches Scoresheet</h1>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <TeamTable label="Team A" rows={rows} team="A" players={teamAPlayers} />
        <TeamTable label="Team B" rows={rows} team="B" players={teamBPlayers} />
      </div>
      <div style={{ marginTop: 24, fontSize: 10, textAlign: 'center', opacity: .7 }}>Generated {new Date().toLocaleString()} — scibowl.app</div>
    </div>
  );
}

function TeamTable({ label, rows, team, players }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <Th>#</Th>
            <Th>Subj</Th>
            <Th>Type</Th>
            <Th>Cap</Th>
            <Th>P1</Th>
            <Th>P2</Th>
            <Th>P3</Th>
            <Th>Bonus</Th>
            <Th>Pen</Th>
            <Th>Score</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            if (r.pad) {
              return (
                <tr key={r.index}>
                  <Td>{r.index}</Td>
                  <Td colSpan={8} style={{ textAlign: 'center', opacity: .4 }}>—</Td>
                  <Td>{team === 'A' ? r.cumA : r.cumB}</Td>
                </tr>
              );
            }
            const attempts = r.attempts || [];
            const byThisTeam = attempts.filter(a => a && a.playerId != null);
            const seatMap = seatAttemptMarkers(r, team, byThisTeam, players);
            return (
              <tr key={r.index}>
                <Td>{r.index}</Td>
                <Td>{r.subject || ''}</Td>
                <Td>{r.type || ''}</Td>
                <Td>{seatMap.captain}</Td>
                <Td>{seatMap.p1}</Td>
                <Td>{seatMap.p2}</Td>
                <Td>{seatMap.p3}</Td>
                <Td>{team === 'A' ? (r.bonusA || '') : (r.bonusB || '')}</Td>
                <Td>{team === 'A' ? (r.penaltyA || '') : (r.penaltyB || '')}</Td>
                <Td>{team === 'A' ? r.cumA : r.cumB}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function seatAttemptMarkers(row, team, attempts, players) {
  // Determine seat order (captain, p1, p2, p3) by the order players appear for that team.
  const teamPlayers = players.filter(p => p.team === team);
  const [captain, p1, p2, p3] = teamPlayers;
  function markerFor(player) {
    if (!player) return '';
    const pa = row.attempts?.filter(a => a.playerId === player.id) || [];
    if (!pa.length) return '';
    const last = pa[pa.length - 1];
    const correct = last.result === 'correct';
    const interrupt = last.interrupt;
    if (correct && interrupt) return 'CI';
    if (correct) return 'C';
    if (!correct && interrupt) return 'II';
    return 'I';
  }
  return {
    captain: markerFor(captain),
    p1: markerFor(p1),
    p2: markerFor(p2),
    p3: markerFor(p3)
  };
}

function Th({ children }) {
  return <th style={{ border: '1px solid #64748b', padding: '2px 4px', fontWeight: 600 }}>{children}</th>;
}
function Td({ children, colSpan, style }) {
  return <td colSpan={colSpan} style={{ border: '1px solid #94a3b8', padding: '2px 4px', textAlign: 'center', ...style }}>{children}</td>;
}
