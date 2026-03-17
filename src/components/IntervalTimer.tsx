'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, RotateCcw, Plus, Minus, Trash2, Save, 
  Share2, Library, CheckCircle2, Copy, GripVertical, 
  Zap, Clock, ListPlus 
} from 'lucide-react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

const WORK_PHRASES = ["Let's go!", "Push it!", "All out!", "You got this!", "Power through!", "No excuses!", "Crush it!", "Stronger every second!"];
const REST_PHRASES = ["Deep breaths.", "Recover and prep.", "Shake it off.", "Stay focused.", "You earned this rest.", "Ready for the next one?", "Great set!", "Keep that heart rate up."];

// --- Sortable Item Component ---
function SortableStep({ 
  step, 
  idx, 
  onRemove, 
  onDuplicate, 
  onUpdateDuration,
  formatTime 
}: { 
  step: WorkoutStep; 
  idx: number; 
  onRemove: (id: string) => void;
  onDuplicate: (step: WorkoutStep) => void;
  onUpdateDuration: (id: string, delta: number) => void;
  formatTime: (s: number) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "p-4 rounded-2xl border flex items-center justify-between group transition-all mb-2", 
        step.type === 'work' ? "bg-red-500/5 border-red-500/20" : "bg-blue-500/5 border-blue-500/20",
        isDragging && "shadow-2xl border-white/40 bg-white/10"
      )}
    >
      <div className="flex items-center gap-4">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded">
          <GripVertical className="w-4 h-4 text-white/20 group-hover:text-white/40" />
        </div>
        <span className="text-white/20 font-black italic min-w-[1.5rem]">{idx + 1}</span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{step.type}</p>
          <p className="text-xl font-mono font-black text-white">{formatTime(step.duration)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onUpdateDuration(step.id, -5)} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white"><Minus className="w-4 h-4"/></button>
        <button onClick={() => onUpdateDuration(step.id, 5)} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white"><Plus className="w-4 h-4"/></button>
        <button onClick={() => onDuplicate(step)} title="Duplicate" className="p-2 text-white/10 hover:text-white/60 transition-colors ml-1"><Copy className="w-4 h-4" /></button>
        <button onClick={() => onRemove(step.id)} className="p-2 text-white/10 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

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
  const [batchOpen, setBatchOpen] = useState(false);
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [lastSavedName, setLastSavedName] = useState('');
  const [showCopied, setShowCopied] = useState(false);

  // Batch Adder State
  const [batchSets, setBatchSets] = useState(4);
  const [batchWork, setBatchWork] = useState(40);
  const [batchRest, setBatchRest] = useState(20);

  const { playSound } = useAudio();
  const { speak } = useTextToSpeech();
  const { requestWakeLock, releaseWakeLock } = useWakeLock();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const announceStep = useCallback((step: WorkoutStep) => {
    const phrases = step.type === 'work' ? WORK_PHRASES : REST_PHRASES;
    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
    const text = step.type === 'work' ? `Start work, for ${step.duration} seconds. ${randomPhrase}` : `Rest, for ${step.duration} seconds. ${randomPhrase}`;
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addBatch = () => {
    const newSteps: WorkoutStep[] = [];
    for (let i = 0; i < batchSets; i++) {
      newSteps.push({ id: Math.random().toString(36).substr(2, 9), type: 'work', duration: batchWork });
      if (batchRest > 0) {
        newSteps.push({ id: Math.random().toString(36).substr(2, 9), type: 'rest', duration: batchRest });
      }
    }
    setSteps(prev => [...prev, ...newSteps]);
    setBatchOpen(false);
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Background Distance Mode Effect - Moved to root level of card for full coverage */}
      <AnimatePresence>
        {isStarted && !isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            exit={{ opacity: 0 }}
            className={cn(
              "absolute -inset-[2rem] z-0 pointer-events-none",
              steps[currentStepIndex].type === 'work' ? "bg-red-500" : "bg-blue-500"
            )}
            style={{ 
              boxShadow: steps[currentStepIndex].type === 'work' 
                ? "inset 0 0 100px rgba(239, 68, 68, 0.5)" 
                : "inset 0 0 100px rgba(59, 130, 246, 0.5)" 
            }}
            transition={{ repeat: Infinity, duration: 2, repeatType: "reverse" }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 p-6 flex flex-col h-full min-h-[500px]">
        {!isStarted ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Timeline</h2>
              <div className="flex gap-2">
                <button onClick={() => setBatchOpen(true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/60 hover:text-white transition-all" title="Batch Add"><ListPlus className="w-4 h-4"/></button>
                <button onClick={() => {
                   const name = prompt("Name your workout:", lastSavedName || "My Workout");
                   if (name) {
                     const newSaved = [...savedWorkouts, { id: Date.now().toString(), name, steps }];
                     setSavedWorkouts(newSaved);
                     localStorage.setItem('goje_library', JSON.stringify(newSaved));
                   }
                }} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/60 hover:text-white transition-all"><Save className="w-4 h-4"/></button>
                <button onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setShowCopied(true);
                  setTimeout(() => setShowCopied(false), 2000);
                }} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/60 hover:text-white transition-all">
                  {showCopied ? <CheckCircle2 className="w-4 h-4 text-green-400"/> : <Share2 className="w-4 h-4"/>}
                </button>
                <button onClick={() => setLibraryOpen(true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/60 hover:text-white transition-all"><Library className="w-4 h-4"/></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={steps.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {steps.map((step, idx) => (
                    <SortableStep 
                      key={step.id} 
                      step={step} 
                      idx={idx} 
                      formatTime={formatTime}
                      onRemove={(id) => setSteps(prev => prev.filter(s => s.id !== id))}
                      onDuplicate={(s) => setSteps(prev => {
                        const newSteps = [...prev];
                        const idx = newSteps.findIndex(x => x.id === s.id);
                        newSteps.splice(idx + 1, 0, { ...s, id: Math.random().toString(36).substr(2, 9) });
                        return newSteps;
                      })}
                      onUpdateDuration={(id, delta) => setSteps(prev => prev.map(s => s.id === id ? { ...s, duration: Math.max(5, s.duration + delta) } : s))}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => setSteps(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), type: 'work', duration: 40 }])} className="py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 text-xs font-black uppercase tracking-widest transition-all">+ Add Work</button>
                <button onClick={() => setSteps(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), type: 'rest', duration: 20 }])} className="py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/20 text-xs font-black uppercase tracking-widest transition-all">+ Add Rest</button>
              </div>
            </div>

            <button onClick={startWorkout} disabled={steps.length === 0} className="w-full py-5 bg-white text-black rounded-3xl font-black text-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase italic tracking-tighter shadow-[0_0_30px_rgba(255,255,255,0.3)] mt-4">
              <Play className="fill-current w-6 h-6" /> Start Training
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex-1 flex flex-col items-center justify-center space-y-12 h-full">
            <div className="space-y-4 text-center">
              <h3 className="text-white/40 text-xl font-black italic uppercase tracking-[0.2em]">
                {steps[currentStepIndex].type} PHASE • {currentStepIndex + 1}/{steps.length}
              </h3>
              <div className={cn(
                "text-[10rem] leading-none font-mono font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_50px_rgba(255,255,255,0.3)]",
                steps[currentStepIndex].type !== 'work' && "text-blue-400"
              )}>
                {formatTime(timeLeft)}
              </div>
            </div>

            <div className="flex items-center gap-8 relative z-20">
              <button onClick={() => setIsPaused(!isPaused)} className="p-8 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 hover:bg-white/20 transition-all group active:scale-90">
                {isPaused ? <Play className="w-10 h-10 text-white fill-current" /> : <Pause className="w-10 h-10 text-white fill-current" />}
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

      {/* Overlays (Batch & Library) remain unchanged but integrated into the new structure */}
      <AnimatePresence>
        {batchOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl p-8 flex flex-col justify-center items-center">
             <div className="w-full max-w-sm space-y-8">
                <h3 className="text-3xl font-black text-white italic tracking-tighter text-center uppercase">Batch Generator</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Number of Sets</label>
                    <div className="flex items-center justify-between bg-white/5 rounded-2xl p-4 border border-white/10">
                      <button onClick={() => setBatchSets(Math.max(1, batchSets - 1))} className="p-2"><Minus/></button>
                      <span className="text-2xl font-black font-mono">{batchSets}</span>
                      <button onClick={() => setBatchSets(batchSets + 1)} className="p-2"><Plus/></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest text-red-500/60">Work (s)</label>
                      <input type="number" value={batchWork} onChange={e => setBatchWork(parseInt(e.target.value) || 0)} className="w-full bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-white font-mono text-xl focus:outline-none focus:border-red-500/50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest text-blue-500/60">Rest (s)</label>
                      <input type="number" value={batchRest} onChange={e => setBatchRest(parseInt(e.target.value) || 0)} className="w-full bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-white font-mono text-xl focus:outline-none focus:border-blue-500/50" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={addBatch} className="w-full py-5 bg-white text-black rounded-3xl font-black text-xl uppercase italic tracking-tighter">Generate & Add</button>
                  <button onClick={() => setBatchOpen(false)} className="w-full py-3 text-white/40 font-bold uppercase text-xs tracking-widest">Cancel</button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {libraryOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl p-8 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Library</h3>
              <button onClick={() => setLibraryOpen(false)} className="text-white/40 font-bold tracking-widest text-xs uppercase">Close</button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
              {savedWorkouts.map(w => (
                <div key={w.id} className="p-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group">
                  <div>
                    <h4 className="text-white font-black text-lg uppercase tracking-tighter">{w.name}</h4>
                    <p className="text-xs text-white/40 font-bold uppercase">{w.steps.length} Steps</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSteps(w.steps); setLibraryOpen(false); }} className="px-4 py-2 bg-white text-black text-xs font-black rounded-lg uppercase tracking-widest transition-all">Load</button>
                    <button onClick={() => { const updated = savedWorkouts.filter(x => x.id !== w.id); setSavedWorkouts(updated); localStorage.setItem('goje_library', JSON.stringify(updated)); }} className="p-2 text-white/10 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
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
