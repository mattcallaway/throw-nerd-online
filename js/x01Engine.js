// x01Engine.js — X01 scoring engine, dart-by-dart
// Ported from throw-nerd (Dart → JS), commit 776c086

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
            history: [], // array of { playerId, darts[], scoredTotal, busted, remainingBefore, remainingAfter }
            config,
            winnerId: null,
            lastBusted: false,
            startScore,
        };
    }

    // Apply a full turn (array of Dart objects, max 3)
    applyTurn(state, playerId, darts) {
        if (state.winnerId) return state;

        const pState = state.playerStates[playerId];
        const remainingBefore = pState.remaining;

        let tempRemaining = remainingBefore;
        let busted = false;
        let won = false;
        let scoredTotal = 0;

        for (const dart of darts) {
            if (dart.isMiss) continue;

            const val = dart.total;
            tempRemaining -= val;
            scoredTotal += val;

            if (tempRemaining < 0) {
                busted = true;
                break;
            }

            if (tempRemaining === 0) {
                // Check out condition
                const needsDouble = state.config.doubleOut;
                const needsMaster = state.config.masterOut;
                if (needsDouble && !dart.isDouble) { busted = true; break; }
                if (needsMaster && !(dart.isDouble || dart.isTriple)) { busted = true; break; }
                won = true;
                break;
            }

            if (tempRemaining === 1 && (state.config.doubleOut || state.config.masterOut)) {
                // Can't leave 1 when finishing on double/master required
                busted = true;
                break;
            }
        }

        const remainingAfter = busted ? remainingBefore : tempRemaining;

        const newPlayerStates = {};
        for (const [pid, ps] of Object.entries(state.playerStates)) {
            newPlayerStates[pid] = new X01PlayerState(ps.remaining);
        }
        newPlayerStates[playerId] = new X01PlayerState(remainingAfter);

        const histEntry = {
            playerId,
            darts: darts.map(d => d.toJSON()),
            scoredTotal: busted ? 0 : scoredTotal,
            busted,
            remainingBefore,
            remainingAfter,
        };
        const newHistory = [...state.history, histEntry];

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
            lastBusted: busted,
        };
    }

    undoLastTurn(state) {
        if (state.history.length === 0) return state;

        const history = [...state.history];
        const last = history.pop();

        const newPlayerStates = {};
        for (const [pid, ps] of Object.entries(state.playerStates)) {
            newPlayerStates[pid] = new X01PlayerState(ps.remaining);
        }
        // Restore the score before this turn
        newPlayerStates[last.playerId] = new X01PlayerState(last.remainingBefore);

        const prevIndex = state.playerOrder.indexOf(last.playerId);

        return {
            ...state,
            playerStates: newPlayerStates,
            currentPlayerIndex: prevIndex,
            history,
            winnerId: null,
            lastBusted: false,
        };
    }

    // Preview: compute remaining if these darts are thrown from given remaining
    previewTurn(remaining, darts, config) {
        let temp = remaining;
        let busted = false;
        let scoredTotal = 0;

        for (const dart of darts) {
            if (dart.isMiss) continue;
            const val = dart.total;
            temp -= val;
            scoredTotal += val;

            if (temp < 0) { busted = true; break; }
            if (temp === 0) {
                const needsDouble = config.doubleOut;
                const needsMaster = config.masterOut;
                if (needsDouble && !dart.isDouble) { busted = true; break; }
                if (needsMaster && !(dart.isDouble || dart.isTriple)) { busted = true; break; }
                break;
            }
            if (temp === 1 && (config.doubleOut || config.masterOut)) { busted = true; break; }
        }

        return {
            remaining: busted ? remaining : temp,
            scored: busted ? 0 : scoredTotal,
            busted,
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
