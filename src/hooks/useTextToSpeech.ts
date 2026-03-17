'use client';

import { useCallback, useRef } from 'react';

export function useTextToSpeech() {
  const synth = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);

  const speak = useCallback((text: string) => {
    if (!synth.current) return;
    
    // Cancel any ongoing speech to avoid overlap
    synth.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Try to find a high-quality English voice
    const voices = synth.current.getVoices();
    const premiumVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) || 
                        voices.find(v => v.lang.startsWith('en'));
    
    if (premiumVoice) utterance.voice = premiumVoice;

    synth.current.speak(utterance);
  }, []);

  return { speak };
}
