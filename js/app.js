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
    screen: 'home',   // 'home' | 'setup' | 'game'
    players: [],      // [{id, name}]
    gameState: null,  // engine game state
    engineType: null, // 'x01' | 'cricket'
};

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

function clearSaved() {
    localStorage.removeItem(LS_KEY);
}

// ─── Player ID helper ─────────────────────────────────────────────────────────
function makePlayerId(name, idx) {
    return `p${idx}_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function initHomeScreen() {
    const resumeBtn = document.getElementById('btn-resume');
    const newBtn = document.getElementById('btn-new');
    const hasGame = !!localStorage.getItem(LS_KEY);

    if (hasGame) {
        resumeBtn.style.display = 'inline-flex';
    } else {
        resumeBtn.style.display = 'none';
    }

    resumeBtn.onclick = () => {
        if (loadState()) {
            enterGame();
        }
    };

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
    const cutThroatSection = document.getElementById('cut-throat-section');
    const addPlayerBtn = document.getElementById('btn-add-player');
    const startBtn = document.getElementById('btn-start');
    const backBtn = document.getElementById('btn-setup-back');
    const playerList = document.getElementById('player-list');
    const bestOfSection = document.getElementById('best-of-section');

    let localPlayers = [{ id: makePlayerId('player1', 0), name: 'Player 1' }];

    function updateGameTypeUI() {
        const val = gameTypeSelect.value;
        doubleOutSection.style.display = val === 'x01' ? 'flex' : 'none';
        cutThroatSection.style.display = val === 'cricket' ? 'flex' : 'none';
    }

    function renderPlayers() {
        playerList.innerHTML = '';
        localPlayers.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'player-row';
            row.innerHTML = `
        <span class="player-num">${i + 1}</span>
        <input type="text" class="player-name-input" value="${p.name}" maxlength="16" placeholder="Player ${i + 1}" data-idx="${i}" />
        ${localPlayers.length > 1 ? `<button class="btn-icon btn-remove-player" data-idx="${i}" title="Remove">✕</button>` : ''}
      `;
            playerList.appendChild(row);
        });
        // Bind inputs
        playerList.querySelectorAll('.player-name-input').forEach(input => {
            input.addEventListener('input', e => {
                const idx = parseInt(e.target.dataset.idx);
                localPlayers[idx].name = e.target.value || `Player ${idx + 1}`;
            });
        });
        playerList.querySelectorAll('.btn-remove-player').forEach(btn => {
            btn.addEventListener('click', e => {
                const idx = parseInt(e.target.dataset.idx);
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
        // Read names from inputs
        const inputs = playerList.querySelectorAll('.player-name-input');
        inputs.forEach((inp, i) => {
            localPlayers[i].name = inp.value.trim() || `Player ${i + 1}`;
            localPlayers[i].id = makePlayerId(localPlayers[i].name, i);
        });

        // Avoid duplicate IDs
        const seen = {};
        localPlayers = localPlayers.map((p, i) => {
            const base = p.id;
            if (seen[base]) p.id = `${base}_${i}`;
            seen[p.id] = true;
            return p;
        });

        const gameType = gameTypeSelect.value;
        const legs = parseInt(document.getElementById('select-legs').value) || 1;
        const doubleOut = document.getElementById('chk-double-out').checked;
        const cutThroat = document.getElementById('chk-cut-throat').checked;
        const x01Mode = parseInt(document.getElementById('select-x01-mode')?.value) || 501;

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

        saveState();
        enterGame();
    };

    backBtn.onclick = () => {
        showScreen('home');
        initHomeScreen();
    };

    renderPlayers();
}

// ─── Game Entry ───────────────────────────────────────────────────────────────
function enterGame() {
    showScreen('game');
    if (appState.engineType === 'x01') {
        renderX01();
    } else {
        renderCricket();
    }
}

// ─── X01 Game Screen ──────────────────────────────────────────────────────────
function renderX01() {
    const screen = document.getElementById('screen-game');
    const state = appState.gameState;
    const config = state.config;
    const players = appState.players;
    const currentId = state.playerOrder[state.currentPlayerIndex];

    screen.innerHTML = `
    <div class="game-header">
      <button class="btn-icon btn-back-game" id="btn-x01-back" title="Quit">⟵</button>
      <h2 class="game-title">${config.summary}</h2>
      <button class="btn-icon btn-menu" id="btn-x01-undo" title="Undo">↩</button>
    </div>

    <div class="scoreboard x01-scoreboard" id="x01-scoreboard">
      ${players.map(p => {
        const ps = state.playerStates[p.id];
        const isActive = p.id === currentId && !state.winnerId;
        return `
          <div class="player-card ${isActive ? 'active' : ''}" id="card-${p.id}">
            <div class="player-name-display">${escHtml(p.name)}</div>
            <div class="player-remaining" id="remaining-${p.id}">${ps.remaining}</div>
            ${isActive ? '<div class="active-indicator">🎯 Your turn</div>' : ''}
          </div>
        `;
    }).join('')}
    </div>

    ${state.winnerId ? renderWinBanner(state.winnerId) : ''}

    ${!state.winnerId ? `
    <div class="score-entry-section" id="score-entry">
      <div class="current-turn-label">
        <span class="turn-label-name">${escHtml(players.find(p => p.id === currentId)?.name || '')}</span>
        <span class="turn-label-sub">Enter 3-dart score</span>
      </div>

      <div class="last-score-display" id="last-score-display">
        ${state.bust ? `<span class="bust-text">💥 BUST!</span>` : state.lastScore != null ? `Last: <strong>${state.lastScore}</strong>` : ''}
      </div>

      <div class="numpad" id="x01-numpad">
        <input type="number" id="score-input" class="score-input" placeholder="0" min="0" max="180"
          inputmode="numeric" pattern="[0-9]*" autocomplete="off" />
        <div class="numpad-grid">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, '←', 0, '✓'].map(k => `
            <button class="numpad-key ${k === '✓' ? 'numpad-submit' : k === '←' ? 'numpad-del' : ''}"
              data-key="${k}">${k}</button>
          `).join('')}
        </div>
        <button class="btn-submit-score" id="btn-submit-score">Submit Score</button>
      </div>

      <div class="quick-scores">
        ${[26, 41, 45, 60, 81, 100, 121, 140, 180].map(v => `
          <button class="quick-score-btn" data-val="${v}">${v}</button>
        `).join('')}
      </div>
    </div>
    ` : `
    <div class="new-game-actions">
      <button class="btn-primary" id="btn-play-again">▶ Play Again</button>
      <button class="btn-secondary" id="btn-new-match">⊕ New Match</button>
    </div>
    `}
  `;

    bindX01Events();
}

function bindX01Events() {
    const input = document.getElementById('score-input');
    const submitBtn = document.getElementById('btn-submit-score');

    // Numpad keys
    document.querySelectorAll('.numpad-key').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            if (key === '←') {
                input.value = input.value.slice(0, -1);
            } else if (key === '✓') {
                performX01Submit();
            } else {
                if (input.value.length < 3) input.value += key;
            }
            input.focus();
        });
    });

    // Quick scores
    document.querySelectorAll('.quick-score-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            input.value = btn.dataset.val;
            performX01Submit();
        });
    });

    if (submitBtn) submitBtn.addEventListener('click', performX01Submit);
    if (input) {
        input.addEventListener('keydown', e => { if (e.key === 'Enter') performX01Submit(); });
    }

    const undoBtn = document.getElementById('btn-x01-undo');
    if (undoBtn) undoBtn.addEventListener('click', performX01Undo);

    const backBtn = document.getElementById('btn-x01-back');
    if (backBtn) backBtn.addEventListener('click', confirmQuit);

    const playAgainBtn = document.getElementById('btn-play-again');
    if (playAgainBtn) playAgainBtn.addEventListener('click', playAgain);

    const newMatchBtn = document.getElementById('btn-new-match');
    if (newMatchBtn) newMatchBtn.addEventListener('click', goHome);

    // Auto-focus input
    if (input) setTimeout(() => input.focus(), 100);
}

function performX01Submit() {
    const input = document.getElementById('score-input');
    if (!input) return;
    const val = parseInt(input.value);
    if (isNaN(val) || val < 0 || val > 180) {
        input.classList.add('input-error');
        setTimeout(() => input.classList.remove('input-error'), 600);
        return;
    }
    const currentId = appState.gameState.playerOrder[appState.gameState.currentPlayerIndex];
    appState.gameState = x01Engine.applyScore(appState.gameState, currentId, val);
    input.value = '';
    saveState();
    renderX01();
}

function performX01Undo() {
    if (appState.gameState.history.length === 0) return;
    appState.gameState = x01Engine.undoLastTurn(appState.gameState);
    saveState();
    renderX01();
}

// ─── Cricket Game Screen ──────────────────────────────────────────────────────
function renderCricket() {
    const screen = document.getElementById('screen-game');
    const state = appState.gameState;
    const config = state.config;
    const players = appState.players;
    const currentId = state.playerOrder[state.currentPlayerIndex];

    // Build current turn hits buffer
    if (!window._cricketTurnHits) window._cricketTurnHits = [];
    const pendingHits = window._cricketTurnHits;

    screen.innerHTML = `
    <div class="game-header">
      <button class="btn-icon btn-back-game" id="btn-cr-back" title="Quit">⟵</button>
      <h2 class="game-title">${config.summary}</h2>
      <button class="btn-icon" id="btn-cr-undo" title="Undo">↩</button>
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
            <div class="cricket-player-row ${isActive ? 'active' : ''}" id="crow-${p.id}">
              <div class="cricket-name-col">${escHtml(p.name)}</div>
              ${CRICKET_TARGETS.map(t => {
            const m = ps.marks[t] || 0;
            return `<div class="cricket-mark-cell" data-target="${t}" data-player="${p.id}">${renderMark(m)}</div>`;
        }).join('')}
              <div class="cricket-pts-col">${ps.score}</div>
            </div>
          `;
    }).join('')}
      </div>

      ${state.winnerId ? renderWinBanner(state.winnerId) : ''}

      ${!state.winnerId ? `
      <!-- Hit entry -->
      <div class="cricket-entry">
        <div class="current-turn-label">
          <span class="turn-label-name">${escHtml(players.find(p => p.id === currentId)?.name || '')}</span>
          <span class="turn-label-sub">Tap targets hit</span>
        </div>

        <div class="cricket-pending" id="cricket-pending">
          ${pendingHits.length ? pendingHits.map(h => `<span class="hit-tag">${h.target === 25 ? 'B' : h.target}${h.multiplier > 1 ? 'x' + h.multiplier : ''}</span>`).join('') : '<span class="no-hits">No hits yet</span>'}
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
      ` : `
      <div class="new-game-actions">
        <button class="btn-primary" id="btn-play-again">▶ Play Again</button>
        <button class="btn-secondary" id="btn-new-match">⊕ New Match</button>
      </div>
      `}
    </div>
  `;

    bindCricketEvents();
}

function renderMark(count) {
    if (count === 0) return '<span class="mark mark-0"></span>';
    if (count === 1) return '<span class="mark mark-1">/</span>';
    if (count === 2) return '<span class="mark mark-2">✕</span>';
    return '<span class="mark mark-3 closed">⊗</span>';
}

function bindCricketEvents() {
    document.querySelectorAll('.hit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = parseInt(btn.dataset.target);
            const mult = parseInt(btn.dataset.mult);
            window._cricketTurnHits.push({ target, multiplier: mult });
            renderCricket();
        });
    });

    const clearBtn = document.getElementById('btn-cr-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        window._cricketTurnHits = [];
        renderCricket();
    });

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

    const backBtn = document.getElementById('btn-cr-back');
    if (backBtn) backBtn.addEventListener('click', confirmQuit);

    const playAgainBtn = document.getElementById('btn-play-again');
    if (playAgainBtn) playAgainBtn.addEventListener('click', playAgain);

    const newMatchBtn = document.getElementById('btn-new-match');
    if (newMatchBtn) newMatchBtn.addEventListener('click', goHome);
}

// ─── Win Banner ───────────────────────────────────────────────────────────────
function renderWinBanner(winnerId) {
    const winner = appState.players.find(p => p.id === winnerId);
    return `
    <div class="win-banner" id="win-banner">
      <div class="win-trophy">🏆</div>
      <div class="win-text">${escHtml(winner?.name || 'Winner')} wins!</div>
    </div>
  `;
}

// ─── Util ─────────────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function confirmQuit() {
    if (confirm('Quit current game? Your progress is saved — you can resume later.')) {
        goHome();
    }
}

function goHome() {
    window._cricketTurnHits = [];
    showScreen('home');
    initHomeScreen();
}

function playAgain() {
    window._cricketTurnHits = [];
    // Same config, same players, fresh game
    const config = appState.gameState.config;
    const engine = appState.engineType === 'x01' ? x01Engine : cricketEngine;
    appState.gameState = engine.createInitialState(config, appState.players);
    saveState();
    enterGame();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Check for resume
    const hasGame = !!localStorage.getItem(LS_KEY);
    showScreen('home');
    initHomeScreen();
});
