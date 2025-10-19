export default function isMsTournament(tournamentKey) {
  if (!tournamentKey) return false;
  try {
    return String(tournamentKey).split('-')[0].toLowerCase() === 'ms';
  } catch {
    return false;
  }
}
