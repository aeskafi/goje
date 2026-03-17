'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Plus, Minus, Trash2, Save, Share2, Library, CheckCircle2 } from 'lucide-react';
import { useAudio } from '@/hooks/useAudio';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
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

type SavedWorkout = {
  id: string;
  name: string;
  steps: WorkoutStep[];
};

export function IntervalTimer() {
  const [steps, setSteps] = useState<WorkoutStep[]>([
    { id: '1', type: 'work', duration: 40 },
    { id: '2', type: 'rest', duration: 20 },
  ]);
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [lastSavedName, setLastSavedName] = useState('');
  const [showCopied, setShowCopied] = useState(false);

  const { playSound } = useAudio();
  const { speak } = useTextToSpeech();
  const { requestWakeLock, releaseWakeLock } = useWakeLock();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- URL Syncing Logic ---
  const encodeWorkout = useCallback((stepsToEncode: WorkoutStep[]) => {
    const data = stepsToEncode.map(s => `${s.type[0]}${s.duration}`).join(',');
    const url = new URL(window.location.href);
    url.searchParams.set('w', data);
    window.history.replaceState({}, '', url);
  }, []);

  const decodeWorkout = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get('w');
    if (data) {
      const decodedSteps: WorkoutStep[] = data.split(',').map((s, i) => ({
        id: Math.random().toString(36).substr(2, 9),
        type: s[0] === 'w' ? 'work' : 'rest',
        duration: parseInt(s.substring(1)) || 30
      }));
      setSteps(decodedSteps);
    }
  }, []);

  // --- Local Storage Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('goje_library');
    if (saved) setSavedWorkouts(JSON.parse(saved));
    decodeWorkout();
  }, [decodeWorkout]);

  useEffect(() => {
    if (steps.length > 0 && !isStarted) encodeWorkout(steps);
  }, [steps, isStarted, encodeWorkout]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const announceStep = useCallback((step: WorkoutStep) => {
    const text = step.type === 'work' ? `Start work, for ${step.duration} seconds` : `Rest, for ${step.duration} seconds`;
    speak(text);
  }, [speak]);

  const nextStep = useCallback(() => {
    if (currentStepIndex >= steps.length - 1) {
      playSound('finish');
      speak("Workout complete. Well done.");
      setIsStarted(false);
      releaseWakeLock();
      return;
    }
    
    const nextIdx = currentStepIndex + 1;
    setCurrentStepIndex(nextIdx);
    setTimeLeft(steps[nextIdx].duration);
    playSound(steps[nextIdx].type === 'work' ? 'start_work' : 'start_rest');
    announceStep(steps[nextIdx]);
  }, [currentStepIndex, steps, playSound, speak, announceStep, releaseWakeLock]);

  useEffect(() => {
    if (isStarted && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === 4) speak("3... 2... 1...");
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
  }, [isStarted, isPaused, nextStep, speak]);

  const startWorkout = () => {
    if (steps.length === 0) return;
    setIsStarted(true);
    setCurrentStepIndex(0);
    setTimeLeft(steps[0].duration);
    playSound(steps[0].type === 'work' ? 'start_work' : 'start_rest');
    announceStep(steps[0]);
    requestWakeLock();
  };

  const saveWorkout = () => {
    const name = prompt("Enter a name for this workout:", lastSavedName || "My Workout");
    if (!name) return;
    const newSaved = [...savedWorkouts, { id: Date.now().toString(), name, steps }];
    setSavedWorkouts(newSaved);
    setLastSavedName(name);
    localStorage.setItem('goje_library', JSON.stringify(newSaved));
  };

  const copyWorkoutLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const addStep = (type: 'work' | 'rest') => {
    setSteps(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), type, duration: type === 'work' ? 40 : 20 }]);
  };

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden">
      {/* Background Distance Mode Effect */}
      <AnimatePresence>
        {isStarted && !isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            className={cn(
              "absolute inset-0 z-0",
              steps[currentStepIndex].type === 'work' ? "bg-red-500 shadow-[inset_0_0_100px_rgba(239,68,68,0.5)]" : "bg-blue-500 shadow-[inset_0_0_100px_rgba(59,130,246,0.5)]"
            )}
            transition={{ repeat: Infinity, duration: 2, repeatType: "reverse" }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 p-6 flex flex-col h-full">
        {!isStarted ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Custom Timeline</h2>
              <div className="flex gap-2">
                <button onClick={saveWorkout} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/60 hover:text-white transition-all"><Save className="w-4 h-4"/></button>
                <button onClick={copyWorkoutLink} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/60 hover:text-white transition-all">
                  {showCopied ? <CheckCircle2 className="w-4 h-4 text-green-400"/> : <Share2 className="w-4 h-4"/>}
                </button>
                <button onClick={() => setLibraryOpen(true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/60 hover:text-white transition-all"><Library className="w-4 h-4"/></button>
              </div>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {steps.map((step, idx) => (
                <div key={step.id} className={cn("p-4 rounded-2xl border flex items-center justify-between group transition-all", step.type === 'work' ? "bg-red-500/5 border-red-500/20" : "bg-blue-500/5 border-blue-500/20")}>
                  <div className="flex items-center gap-4">
                    <span className="text-white/20 font-black italic">{idx + 1}</span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{step.type}</p>
                      <p className="text-xl font-mono font-black text-white">{formatTime(step.duration)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setSteps(prev => prev.map(s => s.id === step.id ? { ...s, duration: Math.max(5, s.duration - 5) } : s))} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white"><Minus className="w-4 h-4"/></button>
                    <button onClick={() => setSteps(prev => prev.map(s => s.id === step.id ? { ...s, duration: s.duration + 5 } : s))} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white"><Plus className="w-4 h-4"/></button>
                    <button onClick={() => setSteps(prev => prev.filter(s => s.id !== step.id))} className="p-2 text-white/10 hover:text-red-500 transition-colors ml-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => addStep('work')} className="py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 text-xs font-black uppercase tracking-widest transition-all">+ Add Work</button>
                <button onClick={() => addStep('rest')} className="py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/20 text-xs font-black uppercase tracking-widest transition-all">+ Add Rest</button>
              </div>
            </div>

            <button onClick={startWorkout} disabled={steps.length === 0} className="w-full py-5 bg-white text-black rounded-3xl font-black text-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase italic tracking-tighter shadow-[0_0_30px_rgba(255,255,255,0.3)]">
              <Play className="fill-current w-6 h-6" /> Start Session
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex-1 flex flex-col items-center justify-center space-y-12">
            <div className="space-y-4 text-center">
              <motion.h3 key={currentStepIndex} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-white/40 text-xl font-black italic uppercase tracking-[0.2em]">
                {steps[currentStepIndex].type} PHASE • {currentStepIndex + 1}/{steps.length}
              </motion.h3>
              <motion.div 
                animate={{ scale: isPaused ? 1 : [1, 1.05, 1] }} 
                transition={{ repeat: Infinity, duration: 1 }}
                className={cn(
                  "text-[10rem] leading-none font-mono font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_50px_rgba(255,255,255,0.3)]",
                  !isWorkPhase && "text-blue-400"
                )}
              >
                {formatTime(timeLeft)}
              </motion.div>
            </div>

            <div className="flex items-center gap-8 relative z-20">
              <button onClick={() => setIsPaused(!isPaused)} className="p-8 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 hover:bg-white/20 transition-all group active:scale-90">
                {isPaused ? <Play className="w-10 h-10 text-white fill-current group-hover:scale-110 transition-transform" /> : <Pause className="w-10 h-10 text-white fill-current group-hover:scale-110 transition-transform" />}
              </button>
              <button onClick={() => { setIsStarted(false); releaseWakeLock(); }} className="p-8 bg-white/5 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/10 transition-all text-white/40 hover:text-white active:scale-90">
                <RotateCcw className="w-10 h-10" />
              </button>
            </div>

            <div className="w-full max-w-[300px] flex gap-1.5 h-2">
              {steps.map((s, i) => (
                <div key={s.id} className={cn("flex-1 rounded-full transition-all duration-700", i < currentStepIndex ? "bg-white/40" : (i === currentStepIndex ? (s.type === 'work' ? "bg-red-500" : "bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]") : "bg-white/10"))} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Library Overlay */}
      <AnimatePresence>
        {libraryOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl p-8 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-black text-white italic tracking-tighter">LIBRARY</h3>
              <button onClick={() => setLibraryOpen(false)} className="text-white/40 hover:text-white font-bold tracking-widest text-xs uppercase">Close</button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
              {savedWorkouts.length === 0 && <p className="text-white/20 text-center italic mt-20">No saved workouts yet.</p>}
              {savedWorkouts.map(w => (
                <div key={w.id} className="p-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group hover:border-white/30 transition-all">
                  <div>
                    <h4 className="text-white font-black text-lg uppercase tracking-tighter">{w.name}</h4>
                    <p className="text-xs text-white/40 font-bold uppercase">{w.steps.length} Steps • {formatTime(w.steps.reduce((acc, s) => acc + s.duration, 0))} Total</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSteps(w.steps); setLibraryOpen(false); }} className="px-4 py-2 bg-white text-black text-xs font-black rounded-lg uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Load</button>
                    <button onClick={() => { const updated = savedWorkouts.filter(x => x.id !== w.id); setSavedWorkouts(updated); localStorage.setItem('goje_library', JSON.stringify(updated)); }} className="p-2 text-white/10 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
