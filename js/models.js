// models.js — Core data models ported from throw-nerd (Dart → JS)
// Source: https://github.com/mattcallaway/throw-nerd (commit 776c086)

'use strict';

const GameType = Object.freeze({ X01: 'x01', CRICKET: 'cricket' });
const X01Mode = Object.freeze({ GAME_301: 301, GAME_501: 501 });

class GameConfig {
  constructor({
    type,
    x01Mode = 501,
    doubleIn = false,
    doubleOut = false,
    masterOut = false,
    cutThroat = false,
    legs = 1,
  }) {
    this.type = type;
    this.x01Mode = x01Mode;
    this.doubleIn = doubleIn;
    this.doubleOut = doubleOut;
    this.masterOut = masterOut;
    this.cutThroat = cutThroat;
    this.legs = legs;
  }

  get summary() {
    if (this.type === GameType.X01) {
      const opts = [];
      if (this.doubleIn) opts.push('DI');
      if (this.doubleOut) opts.push('DO');
      if (this.masterOut) opts.push('MO');
      return `${this.x01Mode}${opts.length ? ' ' + opts.join('/') : ''}`;
    }
    if (this.type === GameType.CRICKET) {
      return `Cricket${this.cutThroat ? ' (Cut-Throat)' : ''}`;
    }
    return 'Darts';
  }

  toJSON() {
    return {
      type: this.type,
      x01Mode: this.x01Mode,
      doubleIn: this.doubleIn,
      doubleOut: this.doubleOut,
      masterOut: this.masterOut,
      cutThroat: this.cutThroat,
      legs: this.legs,
    };
  }

  static fromJSON(obj) {
    return new GameConfig(obj);
  }
}

class Dart {
  constructor(value, multiplier) {
    this.value = value;       // base score: 0 (miss), 1-20, 25
    this.multiplier = multiplier; // 1, 2, 3
  }

  get total() { return this.value * this.multiplier; }
  get isDouble() { return this.multiplier === 2; }
  get isTriple() { return this.multiplier === 3; }
  get isMiss() { return this.value === 0; }

  toString() {
    if (this.value === 0) return 'MISS';
    if (this.value === 25) return this.multiplier === 2 ? 'DB' : 'B';
    const prefix = this.multiplier === 2 ? 'D' : this.multiplier === 3 ? 'T' : '';
    return `${prefix}${this.value}`;
  }

  toJSON() { return { value: this.value, multiplier: this.multiplier }; }
  static fromJSON(obj) { return new Dart(obj.value, obj.multiplier); }
}

class Turn {
  constructor(playerId, darts) {
    this.playerId = playerId;
    this.darts = darts; // Array of Dart objects
  }

  get totalScore() { return this.darts.reduce((sum, d) => sum + d.total, 0); }

  toJSON() { return { playerId: this.playerId, darts: this.darts.map(d => d.toJSON()) }; }
  static fromJSON(obj) { return new Turn(obj.playerId, obj.darts.map(Dart.fromJSON)); }
}
