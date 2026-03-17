'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Plus, Minus, Settings2 } from 'lucide-react';
import { useAudio } from '@/hooks/useAudio';
import { useWakeLock } from '@/hooks/useWakeLock';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const workoutPresets = {
  custom: { name: 'Custom', sets: 8, work: 20, rest: 10 },
  amrap10: { name: 'AMRAP 10', sets: 1, work: 600, rest: 0 },
  amrap12: { name: 'AMRAP 12', sets: 1, work: 720, rest: 0 },
  amrap15: { name: 'AMRAP 15', sets: 1, work: 900, rest: 0 },
  emom10: { name: 'EMOM 10', sets: 10, work: 60, rest: 0 },
  emom12: { name: 'EMOM 12', sets: 12, work: 60, rest: 0 },
  tabata: { name: 'Tabata', sets: 8, work: 20, rest: 10 },
  circuit45: { name: 'Circuit 45/15', sets: 12, work: 45, rest: 15 },
  hiit30: { name: 'HIIT 30/15', sets: 15, work: 30, rest: 15 },
};

export function IntervalTimer() {
  const [settings, setSettings] = useState(workoutPresets.tabata);
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPrep, setIsPrep] = useState(false);
  const [currentSet, setCurrentSet] = useState(1);
  const [isWorkPhase, setIsWorkPhase] = useState(true);
  const [timeLeft, setTimeLeft] = useState(5); // Start with prep countdown
  
  const { playSound } = useAudio();
  const { requestWakeLock, releaseWakeLock } = useWakeLock();
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const phaseStartTimeRef = useRef<number>(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNextPhase = useCallback(() => {
    if (isWorkPhase) {
      if (currentSet >= settings.sets) {
        playSound('finish');
        setIsStarted(false);
        releaseWakeLock();
        return;
      }
      setIsWorkPhase(false);
      setTimeLeft(settings.rest);
      playSound('start_rest');
    } else {
      setIsWorkPhase(true);
      setCurrentSet(prev => prev + 1);
      setTimeLeft(settings.work);
      playSound('start_work');
    }
  }, [currentSet, isWorkPhase, settings, playSound, releaseWakeLock]);

  useEffect(() => {
    if (isStarted && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 3 && prev > 1) playSound('countdown');
          if (prev <= 1) {
            if (isPrep) {
              setIsPrep(false);
              setIsWorkPhase(true);
              playSound('start_work');
              return settings.work;
            } else {
              handleNextPhase();
              return 0; // Temporary, will be reset by handleNextPhase
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isStarted, isPaused, isPrep, settings, handleNextPhase, playSound]);

  const startWorkout = () => {
    setIsStarted(true);
    setIsPrep(true);
    setTimeLeft(5);
    setCurrentSet(1);
    setIsWorkPhase(true);
    playSound('countdown');
    requestWakeLock();
  };

  const resetWorkout = () => {
    setIsStarted(false);
    setIsPaused(false);
    setIsPrep(false);
    releaseWakeLock();
  };

  const updateSetting = (key: 'sets' | 'work' | 'rest', delta: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: Math.max(key === 'sets' ? 1 : 0, prev[key] + delta)
    }));
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-8">
      {!isStarted ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-white">Setup Workout</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {Object.entries(workoutPresets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setSettings(preset)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full border transition-all",
                    settings.name === preset.name 
                      ? "bg-white text-black border-white" 
                      : "text-white/60 border-white/20 hover:border-white/40"
                  )}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {[
              { label: 'Sets', value: settings.sets, key: 'sets', step: 1 },
              { label: 'Work', value: formatTime(settings.work), key: 'work', step: 5 },
              { label: 'Rest', value: formatTime(settings.rest), key: 'rest', step: 5 },
            ].map((item) => (
              <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <span className="text-white/60 font-medium">{item.label}</span>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => updateSetting(item.key as any, -item.step)}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <Minus className="w-5 h-5 text-white" />
                  </button>
                  <span className="text-2xl font-mono font-bold text-white min-w-[3ch] text-center">
                    {item.value}
                  </span>
                  <button 
                    onClick={() => updateSetting(item.key as any, item.step)}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <Plus className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={startWorkout}
            className="w-full py-4 bg-white text-black rounded-2xl font-bold text-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Play className="fill-current" /> Start Training
          </button>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-12"
        >
          <div className="space-y-2">
            <h3 className="text-white/60 text-lg font-medium">
              {isPrep ? 'PREPARING' : `SET ${currentSet} / ${settings.sets}`}
            </h3>
            <h2 className={cn(
              "text-6xl font-black tracking-tighter transition-colors",
              isPrep ? "text-yellow-400" : (isWorkPhase ? "text-red-500" : "text-blue-400")
            )}>
              {isPrep ? 'GET READY' : (isWorkPhase ? 'WORK' : 'REST')}
            </h2>
          </div>

          <div className="text-9xl font-mono font-black text-white tracking-tighter">
            {formatTime(timeLeft)}
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-6 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-all"
            >
              {isPaused ? <Play className="w-8 h-8 text-white fill-current" /> : <Pause className="w-8 h-8 text-white fill-current" />}
            </button>
            <button
              onClick={resetWorkout}
              className="p-6 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-all text-white"
            >
              <RotateCcw className="w-8 h-8" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
