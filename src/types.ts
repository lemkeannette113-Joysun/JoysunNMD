/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Point {
  x: number;
  y: number;
}

export interface Enemy {
  id: string;
  start: Point;
  current: Point;
  target: Point;
  speed: number;
  destroyed: boolean;
}

export interface Missile {
  id: string;
  start: Point;
  current: Point;
  target: Point;
  speed: number;
  batteryIndex: number;
  exploded: boolean;
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  growthRate: number;
  phase: 'growing' | 'shrinking';
  finished: boolean;
}

export interface City {
  id: string;
  x: number;
  y: number;
  alive: boolean;
}

export interface Battery {
  id: string;
  x: number;
  y: number;
  missiles: number;
  maxMissiles: number;
  health: number;
  maxHealth: number;
  alive: boolean;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

export type GameState = 'START' | 'PLAYING' | 'WON' | 'GAMEOVER' | 'UPGRADING';
export type Difficulty = 'EASY' | 'HARD' | 'HELL';

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const WIN_SCORE = 2000;
export const UPGRADE_SCORE_INTERVAL = 200;
export const EXPLOSION_MAX_RADIUS = 40;
export const EXPLOSION_GROWTH_RATE = 1.5;
export const MISSILE_SPEED = 10;
export const ENEMY_SPEED_MIN = 0.5;
export const ENEMY_SPEED_MAX = 1.5;
