// app.js — Main application controller for throw-nerd-online
// Handles routing, match state, localStorage persistence, and UI updates

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const LS_KEY = 'tno_match';

// ─── Engines ──────────────────────────────────────────────────────────────────
const x01Engine = new X01Engine();
const cricketEngine = new CricketEngine();

// ─── App State ────────────────────────────────────────────────────────────────
let appState = {
  screen: 'home',
  players: [],
  gameState: null,
  engineType: null,
};

// X01 turn dart buffer — darts thrown so far this turn
let dartBuffer = [];
// Current active modifier: 1 = single, 2 = double, 3 = triple
let activeModifier = 1;

// ─── Screen Routing ───────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${name}`);
  if (el) el.classList.add('active');
  appState.screen = name;
}

// ─── localStorage ─────────────────────────────────────────────────────────────
function saveState() {
  try {
    if (!appState.gameState) return;
    const engine = appState.engineType === 'x01' ? x01Engine : cricketEngine;
    const serialized = engine.serializeState(appState.gameState);
    localStorage.setItem(LS_KEY, JSON.stringify({
      engineType: appState.engineType,
      players: appState.players,
      gameState: serialized,
    }));
  } catch (e) { /* ignore */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const engine = saved.engineType === 'x01' ? x01Engine : cricketEngine;
    appState.engineType = saved.engineType;
    appState.players = saved.players;
    appState.gameState = engine.deserializeState(saved.gameState);
    return true;
  } catch (e) {
    localStorage.removeItem(LS_KEY);
    return false;
  }
}

function clearSaved() { localStorage.removeItem(LS_KEY); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makePlayerId(name, idx) {
  return `p${idx}_${name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'player'}`;
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getPlayer(id) { return appState.players.find(p => p.id === id); }

// ─── Home Screen ──────────────────────────────────────────────────────────────
function initHomeScreen() {
  const resumeBtn = document.getElementById('btn-resume');
  const newBtn = document.getElementById('btn-new');
  const hasGame = !!localStorage.getItem(LS_KEY);

  resumeBtn.style.display = hasGame ? 'inline-flex' : 'none';

  resumeBtn.onclick = () => { if (loadState()) { dartBuffer = []; enterGame(); } };
  newBtn.onclick = () => {
    clearSaved();
    appState.gameState = null;
    showScreen('setup');
    initSetupScreen();
  };
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────
function initSetupScreen() {
  const gameTypeSelect = document.getElementById('select-game-type');
  const doubleOutSection = document.getElementById('double-out-section');
  const x01ModeSection = document.getElementById('x01-mode-section');
  const cutThroatSection = document.getElementById('cut-throat-section');
  const addPlayerBtn = document.getElementById('btn-add-player');
  const startBtn = document.getElementById('btn-start');
  const backBtn = document.getElementById('btn-setup-back');
  const playerList = document.getElementById('player-list');

  let localPlayers = [{ id: makePlayerId('player1', 0), name: 'Player 1' }];

  function updateGameTypeUI() {
    const val = gameTypeSelect.value;
    x01ModeSection.style.display = val === 'x01' ? '' : 'none';
    doubleOutSection.style.display = val === 'x01' ? '' : 'none';
    cutThroatSection.style.display = val === 'cricket' ? '' : 'none';
  }

  function renderPlayers() {
    playerList.innerHTML = '';
    localPlayers.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML = `
        <span class="player-num">${i + 1}</span>
        <input type="text" class="player-name-input" value="${escHtml(p.name)}"
          maxlength="16" placeholder="Player ${i + 1}" data-idx="${i}" />
        ${localPlayers.length > 1
          ? `<button class="btn-remove-player" data-idx="${i}" title="Remove">✕</button>`
          : ''}
      `;
      playerList.appendChild(row);
    });
    playerList.querySelectorAll('.player-name-input').forEach(input => {
      input.addEventListener('input', e => {
        const idx = parseInt(e.target.dataset.idx);
        localPlayers[idx].name = e.target.value || `Player ${idx + 1}`;
      });
    });
    playerList.querySelectorAll('.btn-remove-player').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.target.closest('button').dataset.idx);
        localPlayers.splice(idx, 1);
        localPlayers.forEach((p, i) => { p.id = makePlayerId(p.name, i); });
        renderPlayers();
      });
    });
    addPlayerBtn.disabled = localPlayers.length >= 4;
  }

  gameTypeSelect.addEventListener('change', updateGameTypeUI);
  updateGameTypeUI();

  addPlayerBtn.onclick = () => {
    if (localPlayers.length >= 4) return;
    const idx = localPlayers.length;
    localPlayers.push({ id: makePlayerId(`player${idx + 1}`, idx), name: `Player ${idx + 1}` });
    renderPlayers();
  };

  startBtn.onclick = () => {
    // Snapshot names from inputs
    playerList.querySelectorAll('.player-name-input').forEach((inp, i) => {
      localPlayers[i].name = inp.value.trim() || `Player ${i + 1}`;
      localPlayers[i].id = makePlayerId(localPlayers[i].name, i);
    });

    // Dedup IDs
    const seen = {};
    localPlayers = localPlayers.map((p, i) => {
      if (seen[p.id]) p.id = `${p.id}_${i}`;
      seen[p.id] = true;
      return p;
    });

    const gameType = gameTypeSelect.value;
    const x01Mode = parseInt(document.getElementById('select-x01-mode')?.value) || 501;
    const doubleOut = document.getElementById('chk-double-out').checked;
    const cutThroat = document.getElementById('chk-cut-throat').checked;
    const legs = parseInt(document.getElementById('select-legs').value) || 1;

    const config = new GameConfig({
      type: gameType,
      x01Mode: gameType === 'x01' ? x01Mode : 501,
      doubleOut: gameType === 'x01' ? doubleOut : false,
      cutThroat: gameType === 'cricket' ? cutThroat : false,
      legs,
    });

    appState.players = localPlayers;
    appState.engineType = gameType;
    const engine = gameType === 'x01' ? x01Engine : cricketEngine;
    appState.gameState = engine.createInitialState(config, localPlayers);
    dartBuffer = [];
    saveState();
    enterGame();
  };

  backBtn.onclick = () => { showScreen('home'); initHomeScreen(); };
  renderPlayers();
}

// ─── Game Entry ───────────────────────────────────────────────────────────────
function enterGame() {
  showScreen('game');
  if (appState.engineType === 'x01') renderX01();
  else renderCricket();
}

// ═══════════════════════════════════════════════════════════════════════════════
// X01 GAME SCREEN — Dart-by-dart scoring interface
// ═══════════════════════════════════════════════════════════════════════════════

function renderX01() {
  const state = appState.gameState;
  const config = state.config;
  const players = appState.players;
  const currentId = state.winnerId ? null : state.playerOrder[state.currentPlayerIndex];
  const currentPlayer = currentId ? getPlayer(currentId) : null;

  // Compute live preview of current turn
  const currentPs = currentId ? state.playerStates[currentId] : null;
  const preview = currentPs && dartBuffer.length > 0
    ? x01Engine.previewTurn(currentPs.remaining, dartBuffer, config)
    : null;

  // Last turn info from history
  const lastTurn = state.history.length > 0 ? state.history[state.history.length - 1] : null;

  const screen = document.getElementById('screen-game');
  screen.innerHTML = `
    <div class="game-header">
      <button class="btn-icon" id="btn-x01-back" title="Quit">⟵</button>
      <div class="game-header-center">
        <span class="game-title">${escHtml(config.summary)}</span>
        ${lastTurn ? `<span class="last-turn-pill ${lastTurn.busted ? 'bust' : ''}">
          ${lastTurn.busted ? '💥 BUST' : `+${lastTurn.scoredTotal}`}
        </span>` : ''}
      </div>
      <button class="btn-icon" id="btn-x01-undo" title="Undo last turn" ${state.history.length === 0 ? 'disabled' : ''}>↩</button>
    </div>

    <!-- Player Scoreboard -->
    <div class="x01-scoreboard">
      ${players.map(p => {
    const ps = state.playerStates[p.id];
    const isActive = p.id === currentId;
    const lastEntry = state.history.slice().reverse().find(h => h.playerId === p.id);
    return `
          <div class="player-card ${isActive ? 'active' : ''} ${state.winnerId === p.id ? 'winner' : ''}">
            <div class="player-card-name">${escHtml(p.name)}</div>
            <div class="player-card-score">${ps.remaining}</div>
            ${lastEntry
        ? `<div class="player-card-last ${lastEntry.busted ? 'busted' : ''}">
                  ${lastEntry.busted ? '💥' : ''}${lastEntry.busted ? 'BUST' : lastEntry.scoredTotal}
                </div>`
        : '<div class="player-card-last">—</div>'
      }
            ${isActive && !state.winnerId ? '<div class="active-pip"></div>' : ''}
          </div>
        `;
  }).join('')}
    </div>

    ${state.winnerId ? renderWinBanner(state.winnerId) : `

    <!-- Live Turn Tracker -->
    <div class="turn-tracker">
      <span class="turn-tracker-name">${escHtml(currentPlayer?.name || '')}</span>
      <div class="turn-darts-row">
        ${[0, 1, 2].map(i => {
    const dart = dartBuffer[i];
    if (dart) {
      const isBust = preview?.busted && i === dartBuffer.length - 1;
      return `<div class="turn-dart filled ${isBust ? 'dart-bust' : ''}">${dart.isMiss ? '·MISS' : dart.toString()}</div>`;
    }
    return `<div class="turn-dart empty">${i < dartBuffer.length ? '' : `Dart ${i + 1}`}</div>`;
  }).join('')}
      </div>
      ${preview ? `
        <div class="turn-preview ${preview.busted ? 'preview-bust' : ''}">
          ${preview.busted
          ? '💥 BUST — score reverts'
          : `→ ${preview.remaining} remaining (−${preview.scored})`}
        </div>` : `
        <div class="turn-preview-placeholder">Tap a number to score</div>`
      }
    </div>

    <!-- DART SCORING PAD -->
    <div class="dart-pad" id="dart-pad">

      <!-- Modifier row -->
      <div class="modifier-row">
        <div class="modifier-group">
          <button class="mod-btn ${activeModifier === 1 ? 'active' : ''}" data-mod="1" id="mod-S">SINGLE</button>
          <button class="mod-btn ${activeModifier === 2 ? 'active' : ''}" data-mod="2" id="mod-D">DOUBLE</button>
          <button class="mod-btn ${activeModifier === 3 ? 'active' : ''}" data-mod="3" id="mod-T">TRIPLE</button>
        </div>
        <div class="special-group">
          <button class="spec-btn" id="btn-miss">MISS</button>
          <button class="spec-btn bull-btn" id="btn-bull">BULL${activeModifier === 2 ? 'S' : ''}</button>
        </div>
      </div>

      <!-- Number Grid 1–20 -->
      <div class="number-grid">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(n => `
          <button class="num-btn" data-num="${n}">${n}</button>
        `).join('')}
      </div>

      <!-- Submit Turn -->
      <button class="btn-end-turn ${dartBuffer.length === 0 ? 'disabled' : ''}"
        id="btn-end-turn" ${dartBuffer.length === 0 ? 'disabled' : ''}>
        End Turn ▶
      </button>
    </div>
    `}

    ${state.winnerId ? `
    <div class="new-game-actions">
      <button class="btn-primary" id="btn-play-again">▶ Play Again</button>
      <button class="btn-secondary" id="btn-new-match">⊕ New Match</button>
    </div>` : ''}
  `;

  bindX01Events();
}

function bindX01Events() {
  // Modifier buttons
  document.querySelectorAll('.mod-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeModifier = parseInt(btn.dataset.mod);
      renderX01();
    });
  });

  // MISS button
  const missBtn = document.getElementById('btn-miss');
  if (missBtn) missBtn.addEventListener('click', () => {
    if (dartBuffer.length >= 3) return;
    dartBuffer.push(new Dart(0, 1)); // miss
    if (dartBuffer.length === 3) commitX01Turn();
    else renderX01();
  });

  // BULL button — value 25, modifier 1 (25pts) or 2 (50pts/double bull)
  const bullBtn = document.getElementById('btn-bull');
  if (bullBtn) bullBtn.addEventListener('click', () => {
    if (dartBuffer.length >= 3) return;
    const mult = activeModifier === 2 ? 2 : 1; // only single or double bull
    dartBuffer.push(new Dart(25, mult));
    if (dartBuffer.length === 3) commitX01Turn();
    else renderX01();
  });

  // Number buttons
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (dartBuffer.length >= 3) return;
      const num = parseInt(btn.dataset.num);
      dartBuffer.push(new Dart(num, activeModifier));
      if (dartBuffer.length === 3) commitX01Turn();
      else renderX01();
    });
  });

  // End Turn manually (< 3 darts thrown)
  const endTurnBtn = document.getElementById('btn-end-turn');
  if (endTurnBtn) endTurnBtn.addEventListener('click', () => {
    if (dartBuffer.length === 0) return;
    commitX01Turn();
  });

  // Undo
  const undoBtn = document.getElementById('btn-x01-undo');
  if (undoBtn) undoBtn.addEventListener('click', () => {
    // If there are pending darts in buffer, pop the last one
    if (dartBuffer.length > 0) {
      dartBuffer.pop();
      renderX01();
    } else {
      // Undo the last committed turn
      if (appState.gameState.history.length === 0) return;
      appState.gameState = x01Engine.undoLastTurn(appState.gameState);
      saveState();
      renderX01();
    }
  });

  // Back / Quit
  const backBtn = document.getElementById('btn-x01-back');
  if (backBtn) backBtn.addEventListener('click', confirmQuit);

  // Win-screen buttons
  const playAgainBtn = document.getElementById('btn-play-again');
  if (playAgainBtn) playAgainBtn.addEventListener('click', playAgain);
  const newMatchBtn = document.getElementById('btn-new-match');
  if (newMatchBtn) newMatchBtn.addEventListener('click', goHome);
}

function commitX01Turn() {
  const state = appState.gameState;
  const currentId = state.playerOrder[state.currentPlayerIndex];
  const darts = dartBuffer.slice();
  dartBuffer = [];
  activeModifier = 1;
  appState.gameState = x01Engine.applyTurn(state, currentId, darts);
  saveState();
  renderX01();
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRICKET GAME SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function renderCricket() {
  const screen = document.getElementById('screen-game');
  const state = appState.gameState;
  const config = state.config;
  const players = appState.players;
  const currentId = state.winnerId ? null : state.playerOrder[state.currentPlayerIndex];

  if (!window._cricketTurnHits) window._cricketTurnHits = [];
  const pendingHits = window._cricketTurnHits;

  screen.innerHTML = `
    <div class="game-header">
      <button class="btn-icon" id="btn-cr-back" title="Quit">⟵</button>
      <div class="game-header-center">
        <span class="game-title">${escHtml(config.summary)}</span>
      </div>
      <button class="btn-icon" id="btn-cr-undo" ${state.history.length === 0 ? 'disabled' : ''}>↩</button>
    </div>

    <div class="cricket-layout">
      <!-- Scoreboard grid -->
      <div class="cricket-scoreboard">
        <div class="cricket-header-row">
          <div class="cricket-name-col"></div>
          ${CRICKET_TARGETS.map(t => `<div class="cricket-target-col">${t === 25 ? 'B' : t}</div>`).join('')}
          <div class="cricket-pts-col">PTS</div>
        </div>
        ${players.map(p => {
    const ps = state.playerStates[p.id];
    const isActive = p.id === currentId && !state.winnerId;
    return `
            <div class="cricket-player-row ${isActive ? 'active' : ''} ${state.winnerId === p.id ? 'winner-row' : ''}">
              <div class="cricket-name-col">${escHtml(p.name)}</div>
              ${CRICKET_TARGETS.map(t => `
                <div class="cricket-mark-cell">${renderMark(ps.marks[t] || 0)}</div>
              `).join('')}
              <div class="cricket-pts-col">${ps.score}</div>
            </div>
          `;
  }).join('')}
      </div>

      ${state.winnerId ? renderWinBanner(state.winnerId) : `
      <!-- Hit Entry -->
      <div class="cricket-entry">
        <div class="current-turn-label">
          <span class="turn-label-name">${escHtml(players.find(p => p.id === currentId)?.name || '')}</span>
          <span class="turn-label-sub">Tap hits this turn</span>
        </div>
        <div class="cricket-pending">
          ${pendingHits.length
        ? pendingHits.map(h => `<span class="hit-tag">${h.target === 25 ? '🎯' : h.target}${h.multiplier > 1 ? '×' + h.multiplier : ''}</span>`).join('')
        : '<span class="no-hits">No hits yet this turn</span>'}
        </div>
        <div class="cricket-buttons">
          ${CRICKET_TARGETS.map(t => `
            <div class="cricket-target-group">
              <span class="target-label">${t === 25 ? 'Bull' : t}</span>
              <div class="target-mult-btns">
                <button class="hit-btn" data-target="${t}" data-mult="1">×1</button>
                <button class="hit-btn" data-target="${t}" data-mult="2">×2</button>
                <button class="hit-btn" data-target="${t}" data-mult="3">×3</button>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="cricket-entry-actions">
          <button class="btn-secondary btn-sm" id="btn-cr-clear">Clear</button>
          <button class="btn-primary btn-sm" id="btn-cr-submit">End Turn →</button>
        </div>
      </div>
      `}
    </div>

    ${state.winnerId ? `
    <div class="new-game-actions">
      <button class="btn-primary" id="btn-play-again">▶ Play Again</button>
      <button class="btn-secondary" id="btn-new-match">⊕ New Match</button>
    </div>` : ''}
  `;

  bindCricketEvents();
}

function renderMark(count) {
  if (count === 0) return '<span class="mark mark-0">·</span>';
  if (count === 1) return '<span class="mark mark-1">/</span>';
  if (count === 2) return '<span class="mark mark-2">✕</span>';
  return '<span class="mark mark-3">⊗</span>';
}

function bindCricketEvents() {
  document.querySelectorAll('.hit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window._cricketTurnHits.push({ target: parseInt(btn.dataset.target), multiplier: parseInt(btn.dataset.mult) });
      renderCricket();
    });
  });

  const clearBtn = document.getElementById('btn-cr-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => { window._cricketTurnHits = []; renderCricket(); });

  const submitBtn = document.getElementById('btn-cr-submit');
  if (submitBtn) submitBtn.addEventListener('click', () => {
    const hits = window._cricketTurnHits.slice();
    window._cricketTurnHits = [];
    const currentId = appState.gameState.playerOrder[appState.gameState.currentPlayerIndex];
    appState.gameState = cricketEngine.applyHits(appState.gameState, currentId, hits);
    saveState();
    renderCricket();
  });

  const undoBtn = document.getElementById('btn-cr-undo');
  if (undoBtn) undoBtn.addEventListener('click', () => {
    window._cricketTurnHits = [];
    appState.gameState = cricketEngine.undoLastTurn(appState.gameState);
    saveState();
    renderCricket();
  });

  document.getElementById('btn-cr-back')?.addEventListener('click', confirmQuit);
  document.getElementById('btn-play-again')?.addEventListener('click', playAgain);
  document.getElementById('btn-new-match')?.addEventListener('click', goHome);
}

// ─── Win Banner ───────────────────────────────────────────────────────────────
function renderWinBanner(winnerId) {
  const winner = getPlayer(winnerId);
  return `
    <div class="win-banner">
      <div class="win-trophy">🏆</div>
      <div class="win-name">${escHtml(winner?.name || 'Winner')}</div>
      <div class="win-sub">checks out!</div>
    </div>
  `;
}

// ─── Global Actions ───────────────────────────────────────────────────────────
function confirmQuit() {
  if (confirm('Quit this game? Progress is saved — you can resume from the home screen.')) goHome();
}

function goHome() {
  dartBuffer = [];
  activeModifier = 1;
  window._cricketTurnHits = [];
  showScreen('home');
  initHomeScreen();
}

function playAgain() {
  dartBuffer = [];
  activeModifier = 1;
  window._cricketTurnHits = [];
  const config = appState.gameState.config;
  const engine = appState.engineType === 'x01' ? x01Engine : cricketEngine;
  appState.gameState = engine.createInitialState(config, appState.players);
  saveState();
  enterGame();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  showScreen('home');
  initHomeScreen();
});
