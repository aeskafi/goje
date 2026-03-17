'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IntervalTimer } from '@/components/IntervalTimer';
import { Stopwatch } from '@/components/Stopwatch';
import { Timer, Clock } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'timer' | 'stopwatch'>('timer');

  return (
    <main className="min-h-screen bg-black relative overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-40 bg-cover bg-center"
        style={{ backgroundImage: "url('/wallpaper.wiki-Wallpapers-Free-Crossfit-Download-PIC-WPB004205-1024x683 (1).jpg')" }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black via-black/80 to-black" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-lg space-y-8">
        <header className="text-center space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-white tracking-tighter"
          >
            GOJE <span className="text-white/40">TRAINING</span>
          </motion.h1>
          <div className="flex justify-center">
            <div className="bg-white/5 backdrop-blur-xl p-1 rounded-2xl border border-white/10 flex gap-1">
              <button
                onClick={() => setActiveTab('timer')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
                  activeTab === 'timer' ? "bg-white text-black" : "text-white/60 hover:text-white"
                )}
              >
                <Timer className="w-4 h-4" /> Timer
              </button>
              <button
                onClick={() => setActiveTab('stopwatch')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
                  activeTab === 'stopwatch' ? "bg-white text-black" : "text-white/60 hover:text-white"
                )}
              >
                <Clock className="w-4 h-4" /> Stopwatch
              </button>
            </div>
          </div>
        </header>

        <div className="bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              {activeTab === 'timer' ? <IntervalTimer /> : <Stopwatch />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
