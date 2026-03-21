const API_BASE = 'https://api.squiggle.com.au/?q=games;year=';
const gamesEl = document.getElementById('games');
const subtitleEl = document.getElementById('subtitle');
const refreshStatusEl = document.getElementById('refresh-status');
const refreshButton = document.getElementById('refresh-button');
const template = document.getElementById('game-template');

function getStatus(game) {
  const timestr = String(game.timestr || '').toLowerCase();
  if (game.complete >= 100 || timestr.includes('full time')) return 'final';
  if (timestr && !timestr.includes('time tbc') && !timestr.includes('scheduled') && !timestr.includes('not started')) return 'live';
  return 'upcoming';
}

function formatScore(goals, behinds, total) {
  if (typeof total !== 'number') return '-';
  if (typeof goals === 'number' && typeof behinds === 'number') return `${goals}.${behinds} (${total})`;
  return String(total);
}

function normalizeGame(game) {
  return {
    id: game.id,
    round: game.round,
    roundName: game.roundname || `Round ${game.round}`,
    venue: game.venue || 'TBA',
    updated: game.updated || null,
    status: getStatus(game),
    timeText: game.timestr || 'Scheduled',
    unixTime: game.unixtime,
    home: {
      name: game.hteam,
      score: formatScore(game.hgoals, game.hbehinds, game.hscore),
      total: game.hscore ?? null
    },
    away: {
      name: game.ateam,
      score: formatScore(game.agoals, game.abehinds, game.ascore),
      total: game.ascore ?? null
    }
  };
}

function pickRound(games) {
  const grouped = new Map();
  for (const game of games) {
    if (!grouped.has(game.round)) grouped.set(game.round, []);
    grouped.get(game.round).push(game);
  }

  for (const [round, list] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
    if (list.some(game => game.status === 'live')) return round;
  }

  for (const [round, list] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
    if (list.some(game => game.status === 'upcoming')) return round;
  }

  return [...grouped.keys()].sort((a, b) => b - a)[0];
}

function formatKickoff(unixTime) {
  if (!unixTime) return 'Time TBC';
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(unixTime * 1000));
}

function formatUpdated(ts) {
  if (!ts) return 'Update time unavailable';
  const date = new Date(ts.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return `Updated ${ts}`;
  return `Updated ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function renderGames(payload) {
  gamesEl.innerHTML = '';
  subtitleEl.textContent = `${payload.roundName} • Auto-refresh every 30s`;

  if (!payload.games.length) {
    gamesEl.innerHTML = '<p class="empty">No games found for the selected round.</p>';
    return;
  }

  for (const game of payload.games) {
    const node = template.content.cloneNode(true);
    const article = node.querySelector('.card');
    const pill = node.querySelector('.pill');
    pill.textContent = game.status.toUpperCase();
    pill.classList.add(`pill-${game.status}`);
    node.querySelector('.time').textContent = game.status === 'live' ? game.timeText : formatKickoff(game.unixTime);
    node.querySelector('.home-name').textContent = game.home.name;
    node.querySelector('.away-name').textContent = game.away.name;
    node.querySelector('.home-score').textContent = game.home.score;
    node.querySelector('.away-score').textContent = game.away.score;
    node.querySelector('.venue').textContent = game.venue;
    node.querySelector('.updated').textContent = game.status === 'upcoming' ? '' : formatUpdated(game.updated);
    if (game.status === 'live') article.classList.add('card-live');
    gamesEl.appendChild(node);
  }
}

async function loadGames() {
  refreshStatusEl.textContent = 'Refreshing…';
  refreshButton.disabled = true;
  try {
    const year = new Date().getFullYear();
    const res = await fetch(`${API_BASE}${year};format=json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const data = await res.json();
    const games = (data.games || []).map(normalizeGame);
    const round = pickRound(games);
    const selected = games.filter(game => game.round === round).sort((a, b) => (a.unixTime || 0) - (b.unixTime || 0));
    renderGames({ roundName: selected[0]?.roundName || `Round ${round}`, games: selected });
    refreshStatusEl.textContent = `Last refresh ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`;
  } catch (error) {
    gamesEl.innerHTML = `<p class="empty">Couldn’t load AFL scores. ${error.message}</p>`;
    refreshStatusEl.textContent = 'Refresh failed';
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', loadGames);
loadGames();
setInterval(loadGames, 30000);
