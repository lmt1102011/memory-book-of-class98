import { useCallback, useEffect, useRef, useState } from 'react';

type AudioContextConstructor = typeof AudioContext;

export const useAmbientTone = () => {
  const [enabled, setEnabled] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Array<OscillatorNode | GainNode>>([]);

  const stop = useCallback(() => {
    nodesRef.current.forEach((node) => {
      if ('stop' in node) {
        try {
          node.stop();
        } catch {
          // Already stopped.
        }
      }
      node.disconnect();
    });
    nodesRef.current = [];
    if (contextRef.current?.state !== 'closed') {
      void contextRef.current?.close();
    }
    contextRef.current = null;
  }, []);

  const start = useCallback(async () => {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;

    if (!AudioCtor) return;

    const context = new AudioCtor();
    const master = context.createGain();
    const low = context.createOscillator();
    const high = context.createOscillator();

    master.gain.value = 0.018;
    low.type = 'sine';
    high.type = 'triangle';
    low.frequency.value = 196;
    high.frequency.value = 392;

    low.connect(master);
    high.connect(master);
    master.connect(context.destination);
    low.start();
    high.start();

    contextRef.current = context;
    nodesRef.current = [low, high, master];
    if (context.state === 'suspended') await context.resume();
  }, []);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      if (next) {
        void start();
      } else {
        stop();
      }
      return next;
    });
  }, [start, stop]);

  useEffect(() => stop, [stop]);

  return { enabled, toggle };
};
