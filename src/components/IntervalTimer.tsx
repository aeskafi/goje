'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Plus, Minus, Trash2, GripVertical, ChevronRight } from 'lucide-react';
import { useAudio } from '@/hooks/useAudio';
import { useWakeLock } from '@/hooks/useWakeLock';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type WorkoutStep = {
  id: string;
  type: 'work' | 'rest';
  duration: number;
};

export function IntervalTimer() {
  // Initial state: A standard set of 4 work/rest intervals
  const [steps, setSteps] = useState<WorkoutStep[]>([
    { id: '1', type: 'work', duration: 40 },
    { id: '2', type: 'rest', duration: 20 },
    { id: '3', type: 'work', duration: 40 },
    { id: '4', type: 'rest', duration: 20 },
  ]);

  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const { playSound } = useAudio();
  const { requestWakeLock, releaseWakeLock } = useWakeLock();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const nextStep = useCallback(() => {
    if (currentStepIndex >= steps.length - 1) {
      playSound('finish');
      setIsStarted(false);
      releaseWakeLock();
      return;
    }
    
    const nextIdx = currentStepIndex + 1;
    setCurrentStepIndex(nextIdx);
    setTimeLeft(steps[nextIdx].duration);
    playSound(steps[nextIdx].type === 'work' ? 'start_work' : 'start_rest');
  }, [currentStepIndex, steps, playSound, releaseWakeLock]);

  useEffect(() => {
    if (isStarted && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 3 && prev > 1) playSound('countdown');
          if (prev <= 1) {
            nextStep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isStarted, isPaused, nextStep, playSound]);

  const startWorkout = () => {
    if (steps.length === 0) return;
    setIsStarted(true);
    setCurrentStepIndex(0);
    setTimeLeft(steps[0].duration);
    playSound(steps[0].type === 'work' ? 'start_work' : 'start_rest');
    requestWakeLock();
  };

  const addStep = (type: 'work' | 'rest') => {
    setSteps(prev => [...prev, { 
      id: Math.random().toString(36).substr(2, 9), 
      type, 
      duration: type === 'work' ? 30 : 15 
    }]);
  };

  const removeStep = (id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  const updateDuration = (id: string, delta: number) => {
    setSteps(prev => prev.map(s => 
      s.id === id ? { ...s, duration: Math.max(5, s.duration + delta) } : s
    ));
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 space-y-6">
      {!isStarted ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Custom Timeline</h2>
            <div className="flex gap-2">
              <button onClick={() => addStep('work')} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold border border-red-500/30">+ Work</button>
              <button onClick={() => addStep('rest')} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-bold border border-blue-500/30">+ Rest</button>
            </div>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {steps.map((step, idx) => (
              <motion.div 
                layout
                key={step.id}
                className={cn(
                  "p-3 rounded-xl border flex items-center justify-between group",
                  step.type === 'work' ? "bg-red-500/5 border-red-500/20" : "bg-blue-500/5 border-blue-500/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-white/20 font-black italic">{idx + 1}</span>
                  <div className={cn(
                    "w-2 h-8 rounded-full",
                    step.type === 'work' ? "bg-red-500" : "bg-blue-500"
                  )} />
                  <div>
                    <p className="text-xs font-bold uppercase text-white/40">{step.type}</p>
                    <p className="text-lg font-mono font-bold text-white">{formatTime(step.duration)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => updateDuration(step.id, 5)} className="p-1 hover:bg-white/10 rounded-md"><Plus className="w-3 h-3 text-white/60"/></button>
                    <button onClick={() => updateDuration(step.id, -5)} className="p-1 hover:bg-white/10 rounded-md"><Minus className="w-3 h-3 text-white/60"/></button>
                  </div>
                  <button onClick={() => removeStep(step.id)} className="p-2 text-white/20 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          <button
            onClick={startWorkout}
            disabled={steps.length === 0}
            className="w-full py-4 bg-white text-black rounded-2xl font-black text-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase italic tracking-tighter"
          >
            <Play className="fill-current" /> Ignite Workout
          </button>
        </motion.div>
      ) : (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-8">
          <div className="space-y-2">
            <h3 className="text-white/40 text-lg font-black italic uppercase tracking-widest">
              Step {currentStepIndex + 1} of {steps.length}
            </h3>
            <h2 className={cn(
              "text-7xl font-black tracking-tighter italic uppercase transition-colors",
              steps[currentStepIndex].type === 'work' ? "text-red-500" : "text-blue-400"
            )}>
              {steps[currentStepIndex].type}
            </h2>
          </div>

          <div className="text-9xl font-mono font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
            {formatTime(timeLeft)}
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-6 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-all group"
            >
              {isPaused ? <Play className="w-8 h-8 text-white fill-current group-hover:scale-110" /> : <Pause className="w-8 h-8 text-white fill-current group-hover:scale-110" />}
            </button>
            <button
              onClick={() => { setIsStarted(false); releaseWakeLock(); }}
              className="p-6 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-all text-white/60 hover:text-white"
            >
              <RotateCcw className="w-8 h-8" />
            </button>
          </div>

          {/* Mini-timeline preview */}
          <div className="flex gap-1 h-2 px-8">
            {steps.map((s, i) => (
              <div 
                key={s.id} 
                className={cn(
                  "flex-1 rounded-full transition-all duration-500",
                  i < currentStepIndex ? "bg-white/20" : (i === currentStepIndex ? (s.type === 'work' ? "bg-red-500" : "bg-blue-500") : "bg-white/5")
                )}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
