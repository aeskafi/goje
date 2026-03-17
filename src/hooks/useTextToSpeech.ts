'use client';

import { useCallback, useRef, useEffect } from 'react';

export function useTextToSpeech() {
  const synth = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synth.current = window.speechSynthesis;
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!synth.current) return;
    
    // Cancel any ongoing speech to avoid overlap and clear queue
    synth.current.cancel();

    // Chrome/Safari sometimes need a resume if the engine hangs
    if (synth.current.paused) {
      synth.current.resume();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Ensure voices are loaded
    const voices = synth.current.getVoices();
    
    const findVoice = () => {
      const v = synth.current?.getVoices();
      if (!v) return;
      const premiumVoice = v.find(voice => voice.name.includes('Google') && voice.lang.startsWith('en')) || 
                           v.find(voice => voice.lang.startsWith('en'));
      if (premiumVoice) utterance.voice = premiumVoice;
      synth.current?.speak(utterance);
    };

    if (voices.length === 0) {
      // If voices aren't loaded yet, wait for them
      synth.current.onvoiceschanged = () => {
        findVoice();
        if (synth.current) synth.current.onvoiceschanged = null;
      };
    } else {
      findVoice();
    }
  }, []);

  return { speak };
}
