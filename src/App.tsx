/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, RotateCcw, Play, Globe } from 'lucide-react';
import { 
  Point, Enemy, Missile, Explosion, City, Battery, GameState, Difficulty,
  GAME_WIDTH, GAME_HEIGHT, WIN_SCORE, EXPLOSION_MAX_RADIUS, 
  EXPLOSION_GROWTH_RATE, MISSILE_SPEED, ENEMY_SPEED_MIN, ENEMY_SPEED_MAX 
} from './types';

const LANGUAGES = {
  en: {
    title: "Fortress Defense",
    start: "Start Game",
    win: "Mission Accomplished!",
    gameOver: "Defense Failed",
    score: "Score",
    target: "Target",
    playAgain: "Play Again",
    missiles: "Missiles",
    instructions: "Click anywhere to intercept incoming rockets. Protect your cities!",
    winDesc: "You reached 2000 points and saved the planet!",
    loseDesc: "All missile batteries have been destroyed.",
    easy: "Easy",
    hard: "Hard",
    hell: "Hell",
    upgradeTitle: "Defense Upgrade Available!",
    upgradeDesc: "Choose an enhancement for your defense system:",
    upgradeRadius: "Explosion Radius +20%",
    upgradeSpeed: "Missile Speed +20%"
  },
  zh: {
    title: "要塞防御",
    start: "开始游戏",
    win: "任务完成！",
    gameOver: "防御失败",
    score: "得分",
    target: "目标",
    playAgain: "再玩一次",
    missiles: "导弹",
    instructions: "点击屏幕任何位置发射拦截导弹。保护你的城市！",
    winDesc: "你达到了2000分，拯救了星球！",
    loseDesc: "所有导弹发射塔已被摧毁。",
    easy: "简单",
    hard: "困难",
    hell: "地狱",
    upgradeTitle: "防御系统升级！",
    upgradeDesc: "请选择一项防御增强：",
    upgradeRadius: "爆炸范围扩大 20%",
    upgradeSpeed: "导弹飞行速度提高 20%"
  }
};

export default function App() {
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const t = LANGUAGES[lang];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [difficulty, setDifficulty] = useState<Difficulty>('HARD');
  const [score, setScore] = useState(0);
  const [batteryMissiles, setBatteryMissiles] = useState<number[]>([50, 100, 50]);
  
  // Upgrade states
  const [explosionRadiusMult, setExplosionRadiusMult] = useState(1);
  const [missileSpeedMult, setMissileSpeedMult] = useState(1);
  const [lastUpgradeScore, setLastUpgradeScore] = useState(0);
  
  // Game refs for high-performance loop
  const enemiesRef = useRef<Enemy[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const batteriesRef = useRef<Battery[]>([]);
  const scoreRef = useRef(0);
  const lastSpawnTime = useRef(0);
  const frameId = useRef<number>(0);

  // Audio synthesis for explosion
  const playExplosionSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      oscillator.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
      
      // Clean up audio context after sound finishes
      setTimeout(() => {
        audioCtx.close();
      }, 600);
    } catch (e) {
      console.error('Audio synthesis failed', e);
    }
  }, []);

  const initGame = useCallback((diff: Difficulty) => {
    const cityWidth = 60;
    const spacing = (GAME_WIDTH - 3 * 40 - 6 * cityWidth) / 8;
    
    // Batteries at indices 0, 4, 8 (roughly)
    const positions = [
      { type: 'battery', x: 40, max: 50 },
      { type: 'city', x: 40 + spacing + cityWidth },
      { type: 'city', x: 40 + 2 * (spacing + cityWidth) },
      { type: 'city', x: 40 + 3 * (spacing + cityWidth) },
      { type: 'battery', x: GAME_WIDTH / 2, max: 100 },
      { type: 'city', x: GAME_WIDTH - 40 - 3 * (spacing + cityWidth) },
      { type: 'city', x: GAME_WIDTH - 40 - 2 * (spacing + cityWidth) },
      { type: 'city', x: GAME_WIDTH - 40 - (spacing + cityWidth) },
      { type: 'battery', x: GAME_WIDTH - 40, max: 50 },
    ];

    citiesRef.current = positions
      .filter(p => p.type === 'city')
      .map((p, i) => ({ id: `city-${i}`, x: p.x, y: GAME_HEIGHT - 30, alive: true }));

    const batteryHealth = diff === 'EASY' ? 2 : 1;
    batteriesRef.current = positions
      .filter(p => p.type === 'battery')
      .map((p, i) => ({ 
        id: `battery-${i}`, 
        x: p.x, 
        y: GAME_HEIGHT - 40, 
        missiles: p.max || 0, 
        maxMissiles: p.max || 0, 
        health: batteryHealth,
        maxHealth: batteryHealth,
        alive: true 
      }));

    enemiesRef.current = [];
    missilesRef.current = [];
    explosionsRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    setLastUpgradeScore(0);
    setExplosionRadiusMult(1);
    setMissileSpeedMult(1);
    setBatteryMissiles(batteriesRef.current.map(b => b.missiles));
  }, []);

  const spawnEnemy = useCallback(() => {
    const targets = [...citiesRef.current.filter(c => c.alive), ...batteriesRef.current.filter(b => b.alive)];
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const startX = Math.random() * GAME_WIDTH;
    
    let speedMult = 1;
    if (difficulty === 'HELL') speedMult = 1.5;

    const newEnemy: Enemy = {
      id: Math.random().toString(36).substr(2, 9),
      start: { x: startX, y: 0 },
      current: { x: startX, y: 0 },
      target: { x: target.x, y: target.y },
      speed: (ENEMY_SPEED_MIN + Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) + (scoreRef.current / 2000)) * speedMult,
      destroyed: false
    };
    enemiesRef.current.push(newEnemy);
  }, [difficulty]);

  const handleFire = (targetX: number, targetY: number) => {
    if (gameState !== 'PLAYING') return;

    // Find closest battery with missiles
    let bestBatteryIdx = -1;
    let minDist = Infinity;

    batteriesRef.current.forEach((b, i) => {
      if (b.alive && b.missiles > 0) {
        const dist = Math.abs(b.x - targetX);
        if (dist < minDist) {
          minDist = dist;
          bestBatteryIdx = i;
        }
      }
    });

    if (bestBatteryIdx !== -1) {
      const battery = batteriesRef.current[bestBatteryIdx];
      battery.missiles -= 1;
      setBatteryMissiles([...batteriesRef.current.map(b => b.missiles)]);

      const newMissile: Missile = {
        id: Math.random().toString(36).substr(2, 9),
        start: { x: battery.x, y: battery.y },
        current: { x: battery.x, y: battery.y },
        target: { x: targetX, y: targetY },
        speed: MISSILE_SPEED * missileSpeedMult,
        batteryIndex: bestBatteryIdx,
        exploded: false
      };
      missilesRef.current.push(newMissile);
    }
  };

  const update = useCallback((time: number) => {
    if (gameState !== 'PLAYING') return;

    if (scoreRef.current - lastUpgradeScore >= 600) {
      setGameState('UPGRADING');
      setLastUpgradeScore(scoreRef.current);
      return;
    }

    // Spawn enemies
    if (time - lastSpawnTime.current > Math.max(500, 2000 - scoreRef.current)) {
      spawnEnemy();
      lastSpawnTime.current = time;
    }

    // Update enemies
    enemiesRef.current.forEach(enemy => {
      const dx = enemy.target.x - enemy.start.x;
      const dy = enemy.target.y - enemy.start.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vx = (dx / dist) * enemy.speed;
      const vy = (dy / dist) * enemy.speed;

      enemy.current.x += vx;
      enemy.current.y += vy;

      // Check if reached target
      if (enemy.current.y >= enemy.target.y) {
        enemy.destroyed = true;
        playExplosionSound();
        // Explode at target
        explosionsRef.current.push({
          id: `exp-enemy-${enemy.id}`,
          x: enemy.target.x,
          y: enemy.target.y,
          radius: 2,
          maxRadius: 30,
          growthRate: 2,
          phase: 'growing',
          finished: false
        });

        // Damage city or battery
        const city = citiesRef.current.find(c => c.x === enemy.target.x && c.y === enemy.target.y);
        if (city) city.alive = false;
        const battery = batteriesRef.current.find(b => b.x === enemy.target.x && b.y === enemy.target.y);
        if (battery) {
          battery.health -= 1;
          if (battery.health <= 0) {
            battery.alive = false;
          }
        }
      }
    });

    // Update missiles
    missilesRef.current.forEach(missile => {
      const dx = missile.target.x - missile.start.x;
      const dy = missile.target.y - missile.start.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vx = (dx / dist) * missile.speed;
      const vy = (dy / dist) * missile.speed;

      missile.current.x += vx;
      missile.current.y += vy;

      // Check if reached target
      const distToTarget = Math.sqrt(
        Math.pow(missile.target.x - missile.current.x, 2) + 
        Math.pow(missile.target.y - missile.current.y, 2)
      );

      if (distToTarget < missile.speed) {
        missile.exploded = true;
        playExplosionSound();
        let radiusMult = explosionRadiusMult;
        if (difficulty === 'EASY') radiusMult *= 2;

        explosionsRef.current.push({
          id: `exp-missile-${missile.id}`,
          x: missile.target.x,
          y: missile.target.y,
          radius: 2,
          maxRadius: EXPLOSION_MAX_RADIUS * radiusMult,
          growthRate: EXPLOSION_GROWTH_RATE,
          phase: 'growing',
          finished: false
        });
      }
    });

    // Update explosions
    explosionsRef.current.forEach(exp => {
      if (exp.phase === 'growing') {
        exp.radius += exp.growthRate;
        if (exp.radius >= exp.maxRadius) {
          exp.phase = 'shrinking';
        }
      } else {
        exp.radius -= exp.growthRate * 0.5;
        if (exp.radius <= 0) {
          exp.finished = true;
        }
      }

      // Check collision with enemies
      enemiesRef.current.forEach(enemy => {
        if (!enemy.destroyed) {
          const dist = Math.sqrt(
            Math.pow(enemy.current.x - exp.x, 2) + 
            Math.pow(enemy.current.y - exp.y, 2)
          );
          if (dist < exp.radius) {
            enemy.destroyed = true;
            scoreRef.current += 20;
            setScore(scoreRef.current);
          }
        }
      });
    });

    // Cleanup
    enemiesRef.current = enemiesRef.current.filter(e => !e.destroyed);
    missilesRef.current = missilesRef.current.filter(m => !m.exploded);
    explosionsRef.current = explosionsRef.current.filter(e => !e.finished);

    // Check Win/Loss
    if (scoreRef.current >= WIN_SCORE) {
      setGameState('WON');
    } else if (batteriesRef.current.every(b => !b.alive)) {
      setGameState('GAMEOVER');
    }
  }, [gameState, spawnEnemy, difficulty, lastUpgradeScore, explosionRadiusMult]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw Ground
    ctx.fillStyle = '#222';
    ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);

    // Draw Cities
    citiesRef.current.forEach(city => {
      if (city.alive) {
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(city.x - 20, city.y - 15, 40, 15);
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(city.x - 15, city.y - 25, 10, 10);
        ctx.fillRect(city.x + 5, city.y - 20, 10, 5);
      } else {
        ctx.fillStyle = '#444';
        ctx.fillRect(city.x - 20, city.y - 5, 40, 5);
      }
    });

    // Draw Batteries
    batteriesRef.current.forEach(battery => {
      if (battery.alive) {
        // Change color based on health
        ctx.fillStyle = battery.health < battery.maxHealth ? '#f59e0b' : '#10b981';
        ctx.beginPath();
        ctx.moveTo(battery.x - 25, battery.y + 20);
        ctx.lineTo(battery.x + 25, battery.y + 20);
        ctx.lineTo(battery.x + 15, battery.y - 10);
        ctx.lineTo(battery.x - 15, battery.y - 10);
        ctx.closePath();
        ctx.fill();
        
        // Cannon
        ctx.strokeStyle = battery.health < battery.maxHealth ? '#d97706' : '#059669';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(battery.x, battery.y - 10);
        ctx.lineTo(battery.x, battery.y - 25);
        ctx.stroke();

        // Health indicator for Easy mode
        if (battery.maxHealth > 1) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${battery.health}/${battery.maxHealth}`, battery.x, battery.y + 35);
        }
      } else {
        ctx.fillStyle = '#444';
        ctx.fillRect(battery.x - 20, battery.y + 10, 40, 10);
      }
    });

    // Draw Enemies
    enemiesRef.current.forEach(enemy => {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(enemy.start.x, enemy.start.y);
      ctx.lineTo(enemy.current.x, enemy.current.y);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(enemy.current.x, enemy.current.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Missiles
    missilesRef.current.forEach(missile => {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(missile.start.x, missile.start.y);
      ctx.lineTo(missile.current.x, missile.current.y);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(missile.current.x, missile.current.y, 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw target X
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      const size = 4;
      ctx.beginPath();
      ctx.moveTo(missile.target.x - size, missile.target.y - size);
      ctx.lineTo(missile.target.x + size, missile.target.y + size);
      ctx.moveTo(missile.target.x + size, missile.target.y - size);
      ctx.lineTo(missile.target.x - size, missile.target.y + size);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      gradient.addColorStop(0.4, 'rgba(255, 200, 50, 0.7)');
      gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (time: number) => {
      update(time);
      draw(ctx);
      frameId.current = requestAnimationFrame(loop);
    };

    frameId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId.current);
  }, [update, draw]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Don't fire too low
    if (y < GAME_HEIGHT - 60) {
      handleFire(x, y);
    }
  };

  const startGame = (diff: Difficulty) => {
    setDifficulty(diff);
    initGame(diff);
    setGameState('PLAYING');
  };

  const applyUpgrade = (type: 'RADIUS' | 'SPEED') => {
    if (type === 'RADIUS') {
      setExplosionRadiusMult(prev => prev * 1.2);
    } else {
      setMissileSpeedMult(prev => prev * 1.2);
    }
    setGameState('PLAYING');
  };

  return (
    <div className="relative w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans">
      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-3">
            <Target className="text-red-500 w-5 h-5" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold">{t.score}</p>
              <p className="text-2xl font-mono font-bold leading-none">{score.toString().padStart(4, '0')}</p>
            </div>
          </div>
          <div className="bg-black/60 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-3">
            <Trophy className="text-yellow-500 w-5 h-5" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold">{t.target}</p>
              <p className="text-xl font-mono font-bold leading-none">{WIN_SCORE}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {batteryMissiles.map((count, i) => (
            <div key={i} className={`bg-black/60 backdrop-blur-md border border-white/10 p-3 rounded-xl flex flex-col items-center min-w-[60px] ${count === 0 ? 'opacity-50' : ''}`}>
              <Shield className={`${i === 1 ? 'text-emerald-400' : 'text-emerald-600'} w-4 h-4 mb-1`} />
              <p className="text-[10px] uppercase text-white/50 font-bold mb-1">{i === 1 ? 'MID' : i === 0 ? 'LEFT' : 'RIGHT'}</p>
              <p className="text-xl font-mono font-bold leading-none">{count}</p>
            </div>
          ))}
        </div>

        <button 
          onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
          className="pointer-events-auto bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
        >
          <Globe className="w-5 h-5" />
        </button>
      </div>

      {/* Game Canvas */}
      <div className="relative w-full max-w-[800px] aspect-[4/3] bg-zinc-900 shadow-2xl shadow-blue-500/10 rounded-lg overflow-hidden border border-white/5">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onMouseDown={handleCanvasClick}
          onTouchStart={handleCanvasClick}
          className="w-full h-full cursor-crosshair"
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState !== 'PLAYING' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-20 p-6 text-center"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md"
              >
                {gameState === 'START' && (
                  <>
                    <h1 className="text-5xl font-bold mb-4 tracking-tighter bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
                      {t.title}
                    </h1>
                    <p className="text-white/60 mb-8 leading-relaxed">
                      {t.instructions}
                    </p>
                    
                    <div className="flex flex-col gap-3 max-w-[200px] mx-auto">
                      <button 
                        onClick={() => startGame('EASY')}
                        className="group relative px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                      >
                        {t.easy}
                      </button>
                      <button 
                        onClick={() => startGame('HARD')}
                        className="group relative px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                      >
                        {t.hard}
                      </button>
                      <button 
                        onClick={() => startGame('HELL')}
                        className="group relative px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                      >
                        {t.hell}
                      </button>
                    </div>
                  </>
                )}

                {gameState === 'UPGRADING' && (
                  <>
                    <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/50">
                      <Shield className="w-10 h-10 text-blue-500" />
                    </div>
                    <h2 className="text-4xl font-bold mb-2 text-white">{t.upgradeTitle}</h2>
                    <p className="text-white/60 mb-8">{t.upgradeDesc}</p>
                    <div className="flex flex-col gap-3 max-w-[250px] mx-auto">
                      <button 
                        onClick={() => applyUpgrade('RADIUS')}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95"
                      >
                        {t.upgradeRadius}
                      </button>
                      <button 
                        onClick={() => applyUpgrade('SPEED')}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold transition-all hover:scale-105 active:scale-95"
                      >
                        {t.upgradeSpeed}
                      </button>
                    </div>
                  </>
                )}

                {gameState === 'WON' && (
                  <>
                    <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/50">
                      <Trophy className="w-10 h-10 text-yellow-500" />
                    </div>
                    <h2 className="text-4xl font-bold mb-2 text-yellow-500">{t.win}</h2>
                    <p className="text-white/60 mb-8">{t.winDesc}</p>
                    <button 
                      onClick={() => setGameState('START')}
                      className="px-8 py-4 bg-white text-black hover:bg-zinc-200 rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto"
                    >
                      <RotateCcw className="w-5 h-5" />
                      {t.playAgain}
                    </button>
                  </>
                )}

                {gameState === 'GAMEOVER' && (
                  <>
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/50">
                      <Shield className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-4xl font-bold mb-2 text-red-500">{t.gameOver}</h2>
                    <p className="text-white/60 mb-8">{t.loseDesc}</p>
                    <button 
                      onClick={() => setGameState('START')}
                      className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto"
                    >
                      <RotateCcw className="w-5 h-5" />
                      {t.playAgain}
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-white/20 text-[10px] uppercase tracking-[0.2em] font-bold">
        &copy; 2026 Fortress Defense &bull; Strategic Interception System
      </div>
    </div>
  );
}
