'use client';

import { useEffect, useRef, useCallback } from 'react';

type SoundName = 'start_work' | 'start_rest' | 'countdown' | 'finish';

export function useAudio() {
  const audioContext = useRef<AudioContext | null>(null);
  const gainNode = useRef<GainNode | null>(null);
  const sounds = useRef<Record<string, AudioBuffer>>({});
  const isInitializing = useRef(false);

  const initAudio = useCallback(() => {
    if (audioContext.current || isInitializing.current) return;
    isInitializing.current = true;

    try {
      const Context = window.AudioContext || (window as any).webkitAudioContext;
      if (Context) {
        audioContext.current = new Context();
        gainNode.current = audioContext.current.createGain();
        // Increased volume to 0.3 for better balance
        gainNode.current.gain.value = 0.3;
        gainNode.current.connect(audioContext.current.destination);
      }
    } catch (e) {
      console.error('Failed to initialize AudioContext', e);
    } finally {
      isInitializing.current = false;
    }
  }, []);

  const loadSound = useCallback(async (name: SoundName, url: string) => {
    try {
      // Ensure context exists before loading
      if (!audioContext.current) initAudio();
      if (!audioContext.current) return;

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);
      sounds.current[name] = audioBuffer;
    } catch (error) {
      console.error(`Error loading sound: ${name}`, error);
    }
  }, [initAudio]);

  useEffect(() => {
    const loadAll = async () => {
      await loadSound('start_work', '/audio/start_work.mp3');
      await loadSound('start_rest', '/audio/start_rest.mp3');
      await loadSound('countdown', '/audio/countdown.mp3');
      await loadSound('finish', '/audio/finish.mp3');
    };
    loadAll();
  }, [loadSound]);

  const playSound = useCallback(async (name: SoundName) => {
    if (!audioContext.current || !sounds.current[name] || !gainNode.current) return;
    
    if (audioContext.current.state === 'suspended') {
      await audioContext.current.resume();
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

  return { playSound, initAudio };
},
