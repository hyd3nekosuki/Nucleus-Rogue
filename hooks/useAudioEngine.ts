import { useEffect, useRef, useState, useCallback } from 'react';
import { DecayMode } from '../types';

export const useAudioEngine = (hp: number, isGameOver: boolean, decayModes: DecayMode[]) => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);
    const compressorRef = useRef<DynamicsCompressorNode | null>(null);
    // Default BGM to ON (false means NOT muted)
    const [isMuted, setIsMuted] = useState(false);
    const nextNoteTimeRef = useRef(0);
    const currentStepRef = useRef(0);
    const timerIDRef = useRef<number | null>(null);

    const hpRef = useRef(hp);
    const decayModesRef = useRef(decayModes);

    useEffect(() => {
        hpRef.current = hp;
        decayModesRef.current = decayModes;
    }, [hp, decayModes]);

    const getPrimaryMode = () => {
        const modes = decayModesRef.current;
        return modes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) 
               || (modes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : DecayMode.STABLE);
    };

    // --- Optimized Synthetic Sound Routines (Focus: 1kHz - 4kHz) ---

    const createKick = (ctx: AudioContext, dest: AudioNode, time: number, intensity: number = 1.0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(dest);

        const freq = 150 * intensity;
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);
    };

    const createClick = (ctx: AudioContext, dest: AudioNode, time: number, type: 'clean' | 'noisy' | 'comical' | 'tribal' | 'metallic') => {
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            if (type === 'clean') data[i] = (i === 0 ? 1 : 0);
            else if (type === 'noisy') data[i] = (Math.random() * 2 - 1) * Math.exp(-i * 0.005);
            else if (type === 'tribal') data[i] = Math.sin(i * 0.12) * Math.exp(-i * 0.008); // High-mid wood block
            else if (type === 'metallic') data[i] = (Math.sin(i * 0.6) + Math.sin(i * 1.4)) * Math.exp(-i * 0.015); // Metallic ring
            else data[i] = Math.sin(i * 0.1) * Math.exp(-i * 0.01); // Boing
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = type === 'noisy' ? 'highpass' : 'bandpass';
        
        let freq = 8000;
        if (type === 'comical') freq = 1200;
        if (type === 'tribal') freq = 2200; 
        if (type === 'metallic') freq = 2800; 
        
        filter.frequency.setValueAtTime(freq, time);
        filter.Q.setValueAtTime(12, time);
        
        gain.gain.setValueAtTime(type === 'noisy' ? 0.25 : 0.45, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        source.start(time);
    };

    const createBass = (ctx: AudioContext, dest: AudioNode, time: number, freq: number, duration: number, style: 'pure' | 'aggressive' | 'airy') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = style === 'aggressive' ? 'sawtooth' : (style === 'airy' ? 'triangle' : 'sine');
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        const cutoff = style === 'aggressive' ? 2400 : (style === 'airy' ? 3800 : 500);
        filter.frequency.setValueAtTime(cutoff, time);
        filter.frequency.exponentialRampToValueAtTime(style === 'airy' ? 800 : 120, time + duration);
        filter.Q.setValueAtTime(style === 'aggressive' ? 18 : 6, time);

        gain.gain.setValueAtTime(0.45, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(time);
        osc.stop(time + duration);
    };

    const scheduler = useCallback(() => {
        if (!audioCtxRef.current || !compressorRef.current) return;
        
        const currentBpm = 124 + (1 - hpRef.current / 100) * 40;
        const secondsPerStep = 60 / currentBpm / 4;

        while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.1) {
            const time = nextNoteTimeRef.current;
            const step = currentStepRef.current;
            const primaryMode = getPrimaryMode();
            const dest = compressorRef.current;

            const isStable = primaryMode === DecayMode.STABLE;
            const isBMinus = primaryMode === DecayMode.BETA_MINUS;
            const isBPlus = primaryMode === DecayMode.BETA_PLUS || primaryMode === DecayMode.ELECTRON_CAPTURE;
            const isAlpha = primaryMode === DecayMode.ALPHA;
            const isFission = primaryMode === DecayMode.SPONTANEOUS_FISSION;
            const isNeutron = primaryMode === DecayMode.NEUTRON_EMISSION;
            const isProton = primaryMode === DecayMode.PROTON_EMISSION;

            if (isStable || isBMinus || isAlpha) {
                if (step % 4 === 0) createKick(audioCtxRef.current, dest, time, isAlpha ? 1.25 : 0.85);
            } else if (isBPlus) {
                if (step % 8 === 0 || step === 10) createKick(audioCtxRef.current, dest, time, 0.95);
            } else if (isFission || isProton) {
                if (step % 2 === 0) createKick(audioCtxRef.current, dest, time, 1.4);
            } else if (isNeutron) {
                if (step % 8 === 0) createKick(audioCtxRef.current, dest, time, 0.75);
            }

            if (isStable) {
                if (step % 2 === 1) createClick(audioCtxRef.current, dest, time, 'clean');
            } else if (isBMinus) {
                createClick(audioCtxRef.current, dest, time, 'noisy'); 
            } else if (isBPlus) {
                if (step % 3 === 0) createClick(audioCtxRef.current, dest, time, 'comical');
            } else if (isAlpha) {
                if (step % 4 === 2 || step === 7) createClick(audioCtxRef.current, dest, time, 'tribal');
            } else if (isProton) {
                if (step % 4 !== 0) createClick(audioCtxRef.current, dest, time, 'metallic');
            } else if (isNeutron) {
                if (step % 2 === 1) createClick(audioCtxRef.current, dest, time, 'noisy'); 
            }

            let shouldPlayBass = false;
            let bassFreq = 50;
            let bassDur = secondsPerStep * 0.9;
            let style: 'pure' | 'aggressive' | 'airy' = 'pure';

            if (isStable) {
                shouldPlayBass = step % 8 === 0;
                bassFreq = 40; 
            } else if (isBMinus) {
                shouldPlayBass = step % 4 !== 0; 
                bassFreq = 55; 
                style = 'aggressive';
            } else if (isBPlus) {
                shouldPlayBass = step % 3 === 1;
                bassFreq = 110 + (Math.sin(step) * 20);
                bassDur = secondsPerStep * 0.5;
            } else if (isAlpha) {
                shouldPlayBass = step % 4 === 0 || step % 4 === 2;
                bassFreq = 45;
                style = 'aggressive';
            } else if (isFission) {
                shouldPlayBass = step % 2 === 0;
                bassFreq = 35;
                style = 'aggressive';
                bassDur = secondsPerStep * 1.5;
            } else if (isNeutron) {
                shouldPlayBass = step % 8 === 4;
                bassFreq = 85;
                style = 'airy';
            } else if (isProton) {
                shouldPlayBass = step % 4 === 0 || step % 8 === 7;
                bassFreq = 65;
                style = 'aggressive';
            }

            if (shouldPlayBass) {
                createBass(audioCtxRef.current, dest, time, bassFreq, bassDur, style);
            }

            nextNoteTimeRef.current += secondsPerStep;
            currentStepRef.current = (currentStepRef.current + 1) % 16;
        }
        timerIDRef.current = window.setTimeout(scheduler, 25);
    }, []);

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioCtxRef.current = ctx;

            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-18, ctx.currentTime);
            compressor.knee.setValueAtTime(20, ctx.currentTime);
            compressor.ratio.setValueAtTime(12, ctx.currentTime);
            compressor.attack.setValueAtTime(0.003, ctx.currentTime);
            compressor.release.setValueAtTime(0.25, ctx.currentTime);
            
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(1.0, ctx.currentTime);

            compressor.connect(masterGain);
            masterGain.connect(ctx.destination);

            compressorRef.current = compressor;
            masterGainRef.current = masterGain;
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    }, []);

    const toggleMute = () => {
        if (isMuted) {
            initAudio();
            nextNoteTimeRef.current = audioCtxRef.current!.currentTime;
            if (!timerIDRef.current) scheduler();
            setIsMuted(false);
        } else {
            if (timerIDRef.current) {
                clearTimeout(timerIDRef.current);
                timerIDRef.current = null;
            }
            setIsMuted(true);
        }
    };

    // Auto-init on first interaction if BGM is preferred ON
    useEffect(() => {
        const handleFirstInteraction = () => {
            if (!isMuted && !audioCtxRef.current) {
                initAudio();
                if (audioCtxRef.current) {
                    nextNoteTimeRef.current = audioCtxRef.current.currentTime;
                    if (!timerIDRef.current && !isGameOver) scheduler();
                }
            }
        };
        window.addEventListener('click', handleFirstInteraction, { once: true });
        window.addEventListener('keydown', handleFirstInteraction, { once: true });
        return () => {
            window.removeEventListener('click', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
        };
    }, [isMuted, isGameOver, initAudio, scheduler]);

    // Handle Game Over: stop the scheduler but PRESERVE isMuted state
    useEffect(() => {
        if (isGameOver) {
            if (timerIDRef.current) {
                clearTimeout(timerIDRef.current);
                timerIDRef.current = null;
            }
        } else if (!isMuted && audioCtxRef.current) {
            // Restart loop if preference is ON and game restarts
            nextNoteTimeRef.current = audioCtxRef.current.currentTime;
            if (!timerIDRef.current) scheduler();
        }
    }, [isGameOver, isMuted, scheduler]);

    return { 
        isMuted, 
        toggleMute, 
        bpm: Math.round(124 + (1 - hp / 100) * 40), 
        primaryMode: getPrimaryMode() 
    };
};