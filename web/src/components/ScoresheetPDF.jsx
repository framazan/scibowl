import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/*
  ScoresheetPDF
  Props:
    sheetRows: Array of rows produced in RoundGenerator (each up to index 25)
    players: list of player objects with team property (A/B) in seating order (first 4 A, next 4 B assumed)
    metadata: optional { generatedAt }
*/

const styles = StyleSheet.create({
  page: { padding: 16, fontSize: 8, fontFamily: 'Times-Roman' },
  title: { textAlign: 'center', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  legendBlock: { marginBottom: 4 },
  tiny: { fontSize: 6.5 },
  footer: { marginTop: 4, textAlign: 'center', fontSize: 6.5 },
  tablesWrap: { flexDirection: 'row' },
  teamACol: { flex: 1.1, marginRight: 4 },
  teamBCol: { flex: 0.9, marginLeft: 4 },
  headerRow: { flexDirection: 'row', backgroundColor: '#eee' },
  bodyRow: { flexDirection: 'row' },
  cell: { borderWidth: 0.5, borderColor: '#000', paddingVertical: 1.5, paddingHorizontal: 2, justifyContent: 'center', textAlign: 'center', minHeight: 12 },
  headCellText: { fontWeight: 'bold', fontSize: 6.5 },
  qnCell: { fontSize: 6.5, fontWeight: 'bold' },
  subjCell: { fontSize: 6.5 },
  attempt: { fontSize: 6.5, fontWeight: 'bold' },
  nameHead: { fontSize: 6, fontWeight: 'bold' },
  spacer: { width: 4 }
});

// Dynamic column builders so we can optionally omit the Sub column if no substitution
function buildColsA(seatCount) { // seatCount = 4 or 5
  return [4,7,6, ...Array(seatCount).fill(9), 7,6,7];
}
function buildColsB(seatCount) { // seatCount = 4 or 5
  return [...Array(seatCount).fill(9), 7,6,7];
}

function HeaderRowA({ playerLabels = [], cols }) {
  const headers = ['Q','Subj','Type', ...playerLabels, 'Bonus','Pen','Score'];
  return (
    <View style={styles.headerRow}>
      {headers.map((h,i)=>{
        const flex = cols[i];
        return (
          <View key={i} style={[styles.cell,{ flexGrow: flex, flexBasis: flex }]}> 
            <Text style={styles.headCellText}>{h}</Text>
          </View>
        );
      })}
    </View>
  );
}

function HeaderRowB({ playerLabels = [], cols }) {
  const headers = [...playerLabels, 'Bonus','Pen','Score'];
  return (
    <View style={styles.headerRow}>
      {headers.map((h,i)=>{
        const flex = cols[i];
        return (
          <View key={i} style={[styles.cell,{ flexGrow: flex, flexBasis: flex }]}> 
            <Text style={styles.headCellText}>{h}</Text>
          </View>
        );
      })}
    </View>
  );
}

function DataRowA({ r, seatPlayers, outRows, cols }) {
  if (!r || r.pad) {
    return (
      <View style={styles.bodyRow}>
        {cols.map((c,i)=>(
          <View key={i} style={[styles.cell,{ flexGrow:c, flexBasis:c }]}> 
            {i===0 && r?.index ? <Text style={styles.qnCell}>{r.index}</Text> : null}
          </View>
        ))}
      </View>
    );
  }
  const attempts = (r.attempts||[]).filter(a=>a && a.playerId!=null);
  // seatPlayers is dynamic (4 or 5)
  function marker(player) {
    if (!player) return '';
    const pa = attempts.filter(a=>a.playerId===player.id);
    if (!pa.length) return '';
    const last = pa[pa.length-1];
    if (last.result === 'correct') return last.interrupt ? 'CI':'C';
    if (last.result === 'incorrect') return last.interrupt ? 'II':'I';
    return '';
  }
  const bonusPts = r.bonusA;
  const penaltyPts = r.penaltyA;
  const cumScore = r.cumA;
  function seatCell(player, colFlex) {
    let content = marker(player);
    if (!content && player && outRows[player.id] === r.index) content = 'out';
    return <View key={player?player.id:Math.random()} style={[styles.cell,{ flexGrow: colFlex, flexBasis: colFlex }]}><Text style={styles.attempt}>{content}</Text></View>;
  }
  const prefix = cols.slice(0,3); // Q, Subj, Type
  const seatCols = cols.slice(3, 3 + seatPlayers.length);
  const tail = cols.slice(3 + seatPlayers.length);
  return (
    <View style={styles.bodyRow}>
      <View style={[styles.cell,{ flexGrow: prefix[0], flexBasis: prefix[0] }]}><Text style={styles.qnCell}>{r.index}</Text></View>
      <View style={[styles.cell,{ flexGrow: prefix[1], flexBasis: prefix[1] }]}><Text style={styles.subjCell}>{r.subject}</Text></View>
      <View style={[styles.cell,{ flexGrow: prefix[2], flexBasis: prefix[2] }]}><Text style={styles.subjCell}>{r.type}</Text></View>
      {seatPlayers.map((p,i)=> seatCell(p, seatCols[i]))}
      <View style={[styles.cell,{ flexGrow: tail[0], flexBasis: tail[0] }]}><Text>{bonusPts? String(bonusPts): ''}</Text></View>
      <View style={[styles.cell,{ flexGrow: tail[1], flexBasis: tail[1] }]}><Text>{penaltyPts? String(penaltyPts): ''}</Text></View>
      <View style={[styles.cell,{ flexGrow: tail[2], flexBasis: tail[2] }]}><Text>{cumScore!=null? String(cumScore): ''}</Text></View>
    </View>
  );
}

function DataRowB({ r, seatPlayers, outRows, cols }) {
  if (!r || r.pad) {
    return (
      <View style={styles.bodyRow}>
        {cols.map((c,i)=>(<View key={i} style={[styles.cell,{ flexGrow:c, flexBasis:c }]} />))}
      </View>
    );
  }
  const attempts = (r.attempts||[]).filter(a=>a && a.playerId!=null);
  function marker(player) {
    if (!player) return '';
    const pa = attempts.filter(a=>a.playerId===player.id);
    if (!pa.length) return '';
    const last = pa[pa.length-1];
    if (last.result === 'correct') return last.interrupt ? 'CI':'C';
    if (last.result === 'incorrect') return last.interrupt ? 'II':'I';
    return '';
  }
  const bonusPts = r.bonusB;
  const penaltyPts = r.penaltyB;
  const cumScore = r.cumB;
  function seatCell(player, colFlex) {
    let content = marker(player);
    if (!content && player && outRows[player.id] === r.index) content = 'out';
    return <View key={player?player.id:Math.random()} style={[styles.cell,{ flexGrow: colFlex, flexBasis: colFlex }]}><Text style={styles.attempt}>{content}</Text></View>;
  }
  const seatCols = cols.slice(0, seatPlayers.length);
  const tail = cols.slice(seatPlayers.length);
  return (
    <View style={styles.bodyRow}>
      {seatPlayers.map((p,i)=> seatCell(p, seatCols[i]))}
      <View style={[styles.cell,{ flexGrow: tail[0], flexBasis: tail[0] }]}><Text>{bonusPts? String(bonusPts): ''}</Text></View>
      <View style={[styles.cell,{ flexGrow: tail[1], flexBasis: tail[1] }]}><Text>{penaltyPts? String(penaltyPts): ''}</Text></View>
      <View style={[styles.cell,{ flexGrow: tail[2], flexBasis: tail[2] }]}><Text>{cumScore!=null? String(cumScore): ''}</Text></View>
    </View>
  );
}

export default function ScoresheetPDF({ sheetRows = [], players = [], metadata = {} }) {
  // Determine active seats (1-4) plus an optional substitute (seat 5) per team
  const teamAAll = players.filter(p=>p.team==='A').sort((a,b)=> (a.seat||0)-(b.seat||0));
  const teamBAll = players.filter(p=>p.team==='B').sort((a,b)=> (a.seat||0)-(b.seat||0));
  const aPrimary = teamAAll.filter(p=> (p.seat||0) >=1 && (p.seat||0) <=4).sort((a,b)=>a.seat-b.seat);
  const bPrimary = teamBAll.filter(p=> (p.seat||0) >=1 && (p.seat||0) <=4).sort((a,b)=>a.seat-b.seat);
  const aSub = teamAAll.find(p=> (p.seat||0) ===5 && p.status==='active');
  const bSub = teamBAll.find(p=> (p.seat||0) ===5 && p.status==='active');
  const aSeats = aSub ? [...aPrimary, aSub] : [...aPrimary];
  const bSeats = bSub ? [...bPrimary, bSub] : [...bPrimary];
  const label = (p, fb) => (p && p.name) ? truncate(p.name, 9) : fb;
  const aLabels = aSeats.map((p,i)=> label(p, ['Captain','P1','P2','P3','Sub'][i] || 'P'+(i+1)) );
  const bLabels = bSeats.map((p,i)=> label(p, ['Captain','P1','P2','P3','Sub'][i] || 'P'+(i+1)) );
  const colsA = buildColsA(aSeats.length);
  const colsB = buildColsB(bSeats.length);

  // Compute OUT row indexes ONLY for replaced players (so we don't mark every inactive).
  function computeOutRows(replacedIds, team) {
    if (!replacedIds.length) return {};
    const lastIdx = {}; // playerId -> last question index attempted
    let maxIdx = 0;
    for (const row of sheetRows) {
      if (!row || row.pad) continue;
      const idx = row.index;
      for (const a of (row.attempts||[])) {
        if (!a || a.team !== team) continue;
        if (replacedIds.includes(a.playerId)) {
          lastIdx[a.playerId] = idx;
          if (idx > maxIdx) maxIdx = idx;
        }
      }
    }
    const outRows = {};
    for (const pid of replacedIds) {
      const li = lastIdx[pid];
      if (li && li < 25) outRows[pid] = li + 1; // show OUT on row after their last attempt
    }
    return outRows;
  }
  const replacedA = teamAAll.filter(p=>p.status==='replaced').map(p=>p.id);
  const replacedB = teamBAll.filter(p=>p.status==='replaced').map(p=>p.id);
  const outRowsA = computeOutRows(replacedA,'A');
  const outRowsB = computeOutRows(replacedB,'B');

  return (
    <Document>
      <Page size="LETTER" style={styles.page} orientation="landscape">
        <Text style={styles.title}>Coaches Scoresheet</Text>
        <View style={styles.legendBlock}>
          <Text style={styles.tiny}>Subjects: E ESS | C Chemistry | B Bio | M Math | P Physics | EN Energy</Text>
          <Text style={styles.tiny}>Types: MC Multiple Choice | SA Short Answer | Markers: C / CI / I / II | 'out' = player substituted</Text>
        </View>
        <View style={styles.tablesWrap}>
          <View style={styles.teamACol}>
            <HeaderRowA playerLabels={aLabels} cols={colsA} />
            {sheetRows.slice(0,25).map(r => <DataRowA key={'A-'+r.index} r={r} seatPlayers={aSeats} outRows={outRowsA} cols={colsA} />)}
          </View>
          <View style={styles.teamBCol}>
            <HeaderRowB playerLabels={bLabels} cols={colsB} />
            {sheetRows.slice(0,25).map(r => <DataRowB key={'B-'+r.index} r={r} seatPlayers={bSeats} outRows={outRowsB} cols={colsB} />)}
          </View>
        </View>
        <Text style={styles.footer}>Generated {metadata.generatedAt || ''} | atombowl</Text>
      </Page>
    </Document>
  );
}

function truncate(str, max) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, max-1) + '…';
}
