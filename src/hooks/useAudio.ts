'use client';

import { useEffect, useRef, useCallback } from 'react';

type SoundName = 'start_work' | 'start_rest' | 'countdown' | 'finish';

export function useAudio() {
  const audioContext = useRef<AudioContext | null>(null);
  const gainNode = useRef<GainNode | null>(null);
  const sounds = useRef<Record<string, AudioBuffer>>({});

  const loadSound = useCallback(async (name: SoundName, url: string) => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainNode.current = audioContext.current.createGain();
        // Lower the volume of sound effects to 0.1 so Voice Guidance is much clearer
        gainNode.current.gain.value = 0.1;
        gainNode.current.connect(audioContext.current.destination);
      }
      
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);
      sounds.current[name] = audioBuffer;
    } catch (error) {
      console.error(`Error loading sound: ${name}`, error);
    }
  }, []);

  useEffect(() => {
    loadSound('start_work', '/audio/start_work.mp3');
    loadSound('start_rest', '/audio/start_rest.mp3');
    loadSound('countdown', '/audio/countdown.mp3');
    loadSound('finish', '/audio/finish.mp3');
  }, [loadSound]);

  const playSound = useCallback((name: SoundName) => {
    if (!audioContext.current || !sounds.current[name] || !gainNode.current) return;
    
    if (audioContext.current.state === 'suspended') {
      audioContext.current.resume();
    }

    try {
      const source = audioContext.current.createBufferSource();
      source.buffer = sounds.current[name];
      source.connect(gainNode.current);
      source.start(0);
    } catch (error) {
      console.error(`Error playing sound: ${name}`, error);
    }
  }, []);

  return { playSound };
}
