'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Flag } from 'lucide-react';

export function Stopwatch() {
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  
  const startTimeRef = useRef<number>(0);
  const requestRef = useRef<number | null>(null);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    const centiseconds = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}.${centiseconds}`;
  };

  const update = () => {
    setTime(Date.now() - startTimeRef.current);
    requestRef.current = requestAnimationFrame(update);
  };

  const handleStartStop = () => {
    if (isRunning) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    } else {
      startTimeRef.current = Date.now() - time;
      requestRef.current = requestAnimationFrame(update);
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setIsRunning(false);
    setTime(0);
    setLaps([]);
  };

  const handleLap = () => {
    setLaps(prev => [time, ...prev]);
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <div className="text-7xl font-mono font-black text-white tracking-tighter tabular-nums">
          {formatTime(time)}
        </div>
      </div>

      <div className="flex items-center justify-center gap-6">
        <button
          onClick={handleStartStop}
          className="p-6 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-all"
        >
          {isRunning ? <Pause className="w-8 h-8 text-white fill-current" /> : <Play className="w-8 h-8 text-white fill-current" />}
        </button>
        <button
          onClick={isRunning ? handleLap : handleReset}
          className="p-6 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-all text-white"
        >
          {isRunning ? <Flag className="w-8 h-8" /> : <RotateCcw className="w-8 h-8" />}
        </button>
      </div>

      <div className="h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {laps.map((lapTime, index) => (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            key={laps.length - index}
            className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10"
          >
            <span className="text-white/40 font-medium">Lap {laps.length - index}</span>
            <span className="text-white font-mono">{formatTime(lapTime)}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
