// x01Engine.js — X01 scoring engine ported from throw-nerd (Dart → JS)
// Source: https://github.com/mattcallaway/throw-nerd (commit 776c086)

'use strict';

class X01PlayerState {
    constructor(remaining) {
        this.remaining = remaining;
    }
    toJSON() { return { remaining: this.remaining }; }
    static fromJSON(obj) { return new X01PlayerState(obj.remaining); }
}

class X01Engine {
    createInitialState(config, players) {
        const startScore = config.x01Mode; // 301 or 501
        const playerStates = {};
        for (const p of players) {
            playerStates[p.id] = new X01PlayerState(startScore);
        }
        return {
            playerStates,
            playerOrder: players.map(p => p.id),
            currentPlayerIndex: 0,
            history: [],
            config,
            winnerId: null,
            bust: false,
            startScore,
        };
    }

    // Apply a turn given a raw score (3-dart total as a number)
    applyScore(state, playerId, rawScore) {
        if (state.winnerId) return state;

        const pState = state.playerStates[playerId];
        const current = pState.remaining;

        let newRemaining = current - rawScore;
        let busted = false;
        let won = false;

        if (newRemaining < 0) {
            busted = true;
        } else if (newRemaining === 0) {
            // Check out condition — for simplicity we trust double-out UI
            // The engine allows the win; UI should gate on double-out if needed
            won = true;
        } else if (newRemaining === 1 && (state.config.doubleOut || state.config.masterOut)) {
            // Can't leave 1 when double-out is required
            busted = true;
        }

        const finalRemaining = busted ? current : newRemaining;

        const newPlayerStates = { ...state.playerStates };
        newPlayerStates[playerId] = new X01PlayerState(finalRemaining);

        const turn = new Turn(playerId, [new Dart(rawScore, 1)]); // simplified: store as single "dart"
        const newHistory = [...state.history, { playerId, score: rawScore, busted, remaining: finalRemaining }];

        let nextIndex = state.currentPlayerIndex;
        if (!won) {
            nextIndex = (state.currentPlayerIndex + 1) % state.playerOrder.length;
        }

        return {
            ...state,
            playerStates: newPlayerStates,
            currentPlayerIndex: nextIndex,
            history: newHistory,
            winnerId: won ? playerId : null,
            bust: busted,
            lastScore: rawScore,
            lastPlayerId: playerId,
        };
    }

    undoLastTurn(state) {
        if (state.history.length === 0) return state;

        const history = [...state.history];
        const last = history.pop();

        // Restore score
        const newPlayerStates = {};
        for (const [pid, ps] of Object.entries(state.playerStates)) {
            newPlayerStates[pid] = new X01PlayerState(ps.remaining);
        }

        // Revert: add back the score that was subtracted (or 0 if busted)
        if (!last.busted) {
            newPlayerStates[last.playerId] = new X01PlayerState(last.remaining + last.score);
        }
        // If busted, the score didn't change — but we still pop history and go back

        // Walk back player index
        const numPlayers = state.playerOrder.length;
        let prevIndex = state.playerOrder.indexOf(last.playerId);

        return {
            ...state,
            playerStates: newPlayerStates,
            currentPlayerIndex: prevIndex,
            history,
            winnerId: null,
            bust: false,
            lastScore: null,
            lastPlayerId: null,
        };
    }

    serializeState(state) {
        const playerStates = {};
        for (const [pid, ps] of Object.entries(state.playerStates)) {
            playerStates[pid] = ps.toJSON();
        }
        return { ...state, playerStates, config: state.config.toJSON() };
    }

    deserializeState(obj) {
        const playerStates = {};
        for (const [pid, ps] of Object.entries(obj.playerStates)) {
            playerStates[pid] = X01PlayerState.fromJSON(ps);
        }
        return { ...obj, playerStates, config: GameConfig.fromJSON(obj.config) };
    }
}
