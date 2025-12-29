import { useEffect, useRef, useState, useCallback } from 'react';
import { DecayMode } from '../types';

export const useAudioEngine = (hp: number, isGameOver: boolean, decayModes: DecayMode[]) => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);
    const compressorRef = useRef<DynamicsCompressorNode | null>(null);
    const [isMuted, setIsMuted] = useState(true);
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

    // --- Electronic Music Sound Generators ---

    const createKick = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, sub: boolean = false) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(sub ? 42 : 55, time);
        osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.4);
        
        gain.gain.setValueAtTime(0.8 * power, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

        if (!sub) {
            const click = ctx.createOscillator();
            const clickGain = ctx.createGain();
            click.type = 'square';
            click.frequency.setValueAtTime(2000, time);
            clickGain.gain.setValueAtTime(0.1, time);
            clickGain.gain.linearRampToValueAtTime(0, time + 0.01);
            click.connect(clickGain); clickGain.connect(dest);
            click.start(time); click.stop(time + 0.01);
        }

        osc.connect(gain); gain.connect(dest);
        osc.start(time); osc.stop(time + 0.4);
    };

    const createSnare = (ctx: AudioContext, dest: AudioNode, time: number, color: 'sharp' | 'deep' = 'sharp') => {
        const noise = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(color === 'sharp' ? 1500 : 800, time);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        noise.connect(filter); filter.connect(gain); gain.connect(dest);
        noise.start(time);
    };

    const createHat = (ctx: AudioContext, dest: AudioNode, time: number, weight: number = 1.0) => {
        const noise = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(8000, time);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15 * weight, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        noise.connect(filter); filter.connect(gain); gain.connect(dest);
        noise.start(time);
    };

    const createSynth = (ctx: AudioContext, dest: AudioNode, time: number, freq: number, duration: number, type: 'pulse' | 'pad' | 'acid' | 'glitch' = 'pulse') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = type === 'pad' || type === 'glitch' ? 'sawtooth' : (type === 'acid' ? 'sawtooth' : 'square');
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        if (type === 'acid') {
            filter.frequency.setValueAtTime(freq, time);
            filter.frequency.exponentialRampToValueAtTime(freq * 8, time + 0.05);
            filter.Q.setValueAtTime(15, time);
        } else if (type === 'glitch') {
            filter.frequency.setValueAtTime(2000, time);
            filter.frequency.exponentialRampToValueAtTime(40, time + duration);
            filter.Q.setValueAtTime(20, time);
        } else if (type === 'pad') {
            filter.frequency.setValueAtTime(400, time);
            filter.frequency.linearRampToValueAtTime(1200, time + duration * 0.5);
        } else {
            filter.frequency.setValueAtTime(2000, time);
        }

        gain.gain.setValueAtTime(0, time);
        const attack = type === 'pad' ? duration * 0.4 : 0.005;
        gain.gain.linearRampToValueAtTime(type === 'pad' ? 0.1 : 0.15, time + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter); filter.connect(gain); gain.connect(dest);
        osc.start(time); osc.stop(time + duration);
    };

    const scheduler = useCallback(() => {
        if (!audioCtxRef.current || !compressorRef.current) return;
        
        const hpFactor = 1.0 - (hpRef.current / 100);
        const baseBpm = 132;
        const currentBpm = baseBpm + (hpFactor * 32); 
        const secondsPerStep = 60 / currentBpm / 4;

        while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.1) {
            const time = nextNoteTimeRef.current;
            const step = currentStepRef.current;
            const primaryMode = getPrimaryMode();
            const dest = compressorRef.current;

            switch (primaryMode) {
                case DecayMode.STABLE:
                    // Minimal Techno
                    if (step % 4 === 0) createKick(audioCtxRef.current, dest, time, 0.8);
                    if (step % 4 === 2) createHat(audioCtxRef.current, dest, time, 0.5);
                    if (step % 8 === 6) createHat(audioCtxRef.current, dest, time, 0.8);
                    if (step % 16 === 14) createSynth(audioCtxRef.current, dest, time, 110, 0.12, 'pulse');
                    break;

                case DecayMode.BETA_MINUS:
                    // Driving Techno
                    if (step % 4 === 0) createKick(audioCtxRef.current, dest, time, 1.1);
                    if (step % 2 === 1) createHat(audioCtxRef.current, dest, time, 1.2);
                    const acidFreq = [110, 110, 220, 110, 164.81, 110, 110, 220][step % 8];
                    if (step % 2 === 0) createSynth(audioCtxRef.current, dest, time, acidFreq, 0.15, 'acid');
                    break;

                case DecayMode.BETA_PLUS:
                    // Cyber Breakbeats
                    if ([0, 3, 6, 9, 13].includes(step)) createKick(audioCtxRef.current, dest, time, 1.0);
                    if (step === 4 || step === 12) createSnare(audioCtxRef.current, dest, time, 'sharp');
                    if (step % 2 === 1) createHat(audioCtxRef.current, dest, time, 0.7);
                    if (step % 16 === 7) createSynth(audioCtxRef.current, dest, time, 440, 0.08, 'pulse');
                    break;

                case DecayMode.ELECTRON_CAPTURE:
                    // Rival Breakbeats (Competitive/Inverted pattern vs Beta+)
                    // Syncopated heavy kicks on steps that clash with Beta+
                    if ([1, 4, 7, 10, 14].includes(step)) createKick(audioCtxRef.current, dest, time, 1.2, true);
                    // Snare on 2 and 11 to disrupt the standard 4/12 break
                    if (step === 2 || step === 11) createSnare(audioCtxRef.current, dest, time, 'sharp');
                    
                    // High-pitch intake glitches simulating electron absorption
                    if (step % 4 === 1) {
                        createSynth(audioCtxRef.current, dest, time, 1760 + Math.random() * 880, 0.05, 'glitch');
                    }
                    // Industrial grinding textures
                    if (step % 8 === 0) {
                        createSynth(audioCtxRef.current, dest, time, 82.41, secondsPerStep * 2, 'acid');
                    }
                    break;

                case DecayMode.ALPHA:
                    // Drum'n'Bass
                    if (step === 0 || step === 10) createKick(audioCtxRef.current, dest, time, 1.3);
                    if (step === 4 || step === 12) createSnare(audioCtxRef.current, dest, time, 'deep');
                    createHat(audioCtxRef.current, dest, time, 0.9);
                    const reeseFreq = step % 8 < 4 ? 55 : 48.99;
                    createSynth(audioCtxRef.current, dest, time, reeseFreq, secondsPerStep * 1.1, 'acid');
                    break;

                case DecayMode.SPONTANEOUS_FISSION:
                    // Hardcore Chaos
                    createKick(audioCtxRef.current, dest, time, 1.5);
                    createSnare(audioCtxRef.current, dest, time, 'sharp');
                    createSynth(audioCtxRef.current, dest, time, Math.random() * 1200 + 40, 0.05, 'acid');
                    break;

                default:
                    if (step % 4 === 0) createKick(audioCtxRef.current, dest, time, 1.0);
                    break;
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
            compressor.threshold.setValueAtTime(-34, ctx.currentTime);
            compressor.knee.setValueAtTime(30, ctx.currentTime);
            compressor.ratio.setValueAtTime(16, ctx.currentTime);
            compressor.attack.setValueAtTime(0.003, ctx.currentTime);
            compressor.release.setValueAtTime(0.12, ctx.currentTime);
            
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.75, ctx.currentTime);

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

    useEffect(() => {
        if (isGameOver) {
            if (timerIDRef.current) {
                clearTimeout(timerIDRef.current);
                timerIDRef.current = null;
            }
        } else if (!isMuted && audioCtxRef.current) {
            nextNoteTimeRef.current = audioCtxRef.current.currentTime;
            if (!timerIDRef.current) scheduler();
        }
    }, [isGameOver, isMuted, scheduler]);

    return { 
        isMuted, 
        toggleMute, 
        bpm: Math.round(132 + ((1 - hp / 100) * 32)), 
        primaryMode: getPrimaryMode() 
    };
};