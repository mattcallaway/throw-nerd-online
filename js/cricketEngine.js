// cricketEngine.js — Cricket scoring engine ported from throw-nerd (Dart → JS)
// Source: https://github.com/mattcallaway/throw-nerd (commit 776c086)

'use strict';

const CRICKET_TARGETS = [15, 16, 17, 18, 19, 20, 25];

class CricketPlayerState {
    constructor(score = 0, marks = null) {
        this.score = score;
        // marks: { 15: 0..3, 16: 0..3, ... }
        this.marks = marks || Object.fromEntries(CRICKET_TARGETS.map(t => [t, 0]));
    }

    isClosed(target) { return this.marks[target] >= 3; }
    allClosed() { return CRICKET_TARGETS.every(t => this.isClosed(t)); }

    toJSON() { return { score: this.score, marks: { ...this.marks } }; }
    static fromJSON(obj) { return new CricketPlayerState(obj.score, obj.marks); }
}

class CricketEngine {
    createInitialState(config, players) {
        const playerStates = {};
        for (const p of players) {
            playerStates[p.id] = new CricketPlayerState();
        }
        return {
            playerStates,
            playerOrder: players.map(p => p.id),
            currentPlayerIndex: 0,
            history: [],
            config,
            winnerId: null,
            lastHits: null,
        };
    }

    // Apply hits: array of { target, multiplier } — e.g. [{target:20, multiplier:3}]
    applyHits(state, playerId, hits) {
        if (state.winnerId) return state;

        // Deep copy player states
        const newPlayerStates = {};
        for (const [pid, ps] of Object.entries(state.playerStates)) {
            newPlayerStates[pid] = new CricketPlayerState(ps.score, { ...ps.marks });
        }

        const me = newPlayerStates[playerId];

        for (const hit of hits) {
            const { target, multiplier } = hit;
            if (!CRICKET_TARGETS.includes(target)) continue;

            const currentMarks = me.marks[target] || 0;
            const totalHits = currentMarks + multiplier;
            const newMarks = Math.min(totalHits, 3);
            me.marks[target] = newMarks;

            // Marks beyond 3 are "scoring hits"
            const scoringHits = Math.max(0, totalHits - 3);

            if (scoringHits > 0) {
                if (state.config.cutThroat) {
                    // Cut-throat: give points to opponents who haven't closed
                    for (const pid of state.playerOrder) {
                        if (pid === playerId) continue;
                        const opp = newPlayerStates[pid];
                        if (!opp.isClosed(target)) {
                            newPlayerStates[pid] = new CricketPlayerState(
                                opp.score + (scoringHits * target),
                                opp.marks
                            );
                        }
                    }
                } else {
                    // Standard: check if all opponents closed — if not, score points for self
                    const closedByAll = state.playerOrder
                        .filter(pid => pid !== playerId)
                        .every(pid => newPlayerStates[pid].isClosed(target));

                    if (!closedByAll) {
                        newPlayerStates[playerId] = new CricketPlayerState(
                            me.score + (scoringHits * target),
                            me.marks
                        );
                    }
                }
            }
        }

        // Win check
        const finalMe = newPlayerStates[playerId];
        let won = false;
        if (finalMe.allClosed()) {
            if (state.config.cutThroat) {
                // Cut-throat: win if lowest or tied-lowest score
                const myScore = finalMe.score;
                won = state.playerOrder
                    .filter(pid => pid !== playerId)
                    .every(pid => newPlayerStates[pid].score >= myScore);
            } else {
                // Standard: win if highest or tied-highest score
                const myScore = finalMe.score;
                won = state.playerOrder
                    .filter(pid => pid !== playerId)
                    .every(pid => newPlayerStates[pid].score <= myScore);
            }
        }

        const historyEntry = { playerId, hits: hits.map(h => ({ ...h })) };
        const newHistory = [...state.history, historyEntry];

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
            lastHits: hits,
            lastPlayerId: playerId,
        };
    }

    undoLastTurn(state) {
        if (state.history.length === 0) return state;

        // Rebuild state from scratch by replaying all but last turn
        const history = state.history.slice(0, -1);
        const freshState = this.createInitialState(state.config,
            state.playerOrder.map(id => ({ id })));

        let rebuilt = freshState;
        for (const entry of history) {
            rebuilt = this.applyHits(rebuilt, entry.playerId, entry.hits);
        }

        return { ...rebuilt, history };
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
            playerStates[pid] = CricketPlayerState.fromJSON(ps);
        }
        return { ...obj, playerStates, config: GameConfig.fromJSON(obj.config) };
    }
}
