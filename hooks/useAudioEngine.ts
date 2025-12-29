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

    // --- SF Techno Sound Generators ---

    const createDeepKick = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const click = ctx.createOscillator();
        const clickGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(power > 1.2 ? 52 : 60, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

        click.type = 'square';
        click.frequency.setValueAtTime(180, time);
        clickGain.gain.setValueAtTime(0.15, time);
        clickGain.gain.linearRampToValueAtTime(0, time + 0.015);

        osc.connect(gain);
        click.connect(clickGain);
        gain.connect(dest);
        clickGain.connect(dest);

        osc.start(time);
        click.start(time);
        osc.stop(time + 0.5);
        click.stop(time + 0.015);
    };

    const createVoidSweep = (ctx: AudioContext, dest: AudioNode, time: number, duration: number) => {
        // Black Hole Suction Effect
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.setValueAtTime(15, time);
        filter.frequency.setValueAtTime(4000, time);
        filter.frequency.exponentialRampToValueAtTime(20, time + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + duration * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        source.start(time);
    };

    const createStellarFM = (ctx: AudioContext, dest: AudioNode, time: number, freq: number, duration: number, modIndex: number = 2) => {
        const carrier = ctx.createOscillator();
        const modulator = ctx.createOscillator();
        const modGain = ctx.createGain();
        const gain = ctx.createGain();
        
        carrier.frequency.setValueAtTime(freq, time);
        modulator.frequency.setValueAtTime(freq * 1.618, time);
        modGain.gain.setValueAtTime(freq * modIndex, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(gain);
        gain.connect(dest);

        carrier.start(time);
        modulator.start(time);
        carrier.stop(time + duration);
        modulator.stop(time + duration);
    };

    const createQuantumHiss = (ctx: AudioContext, dest: AudioNode, time: number, duration: number, color: 'white' | 'dark') => {
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        filter.type = color === 'white' ? 'highpass' : 'bandpass';
        filter.frequency.setValueAtTime(color === 'white' ? 14000 : 600, time);
        
        gain.gain.setValueAtTime(color === 'white' ? 0.08 : 0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        source.start(time);
    };

    const scheduler = useCallback(() => {
        if (!audioCtxRef.current || !compressorRef.current) return;
        
        const hpFactor = 1.0 - (hpRef.current / 100);
        const currentBpm = 126 + (hpFactor * 34); 
        const secondsPerStep = 60 / currentBpm / 4;

        while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.1) {
            const time = nextNoteTimeRef.current;
            const step = currentStepRef.current;
            const primaryMode = getPrimaryMode();
            const dest = compressorRef.current;

            switch (primaryMode) {
                case DecayMode.STABLE:
                    if (step % 4 === 0) createDeepKick(audioCtxRef.current, dest, time, 0.9);
                    if (step % 8 === 2 || step % 8 === 6) createQuantumHiss(audioCtxRef.current, dest, time, 0.04, 'white');
                    if (step % 16 === 14) createStellarFM(audioCtxRef.current, dest, time, 110, 0.15, 0.5);
                    break;

                case DecayMode.BETA_MINUS:
                    if (step % 4 === 0 || step % 16 === 10) createDeepKick(audioCtxRef.current, dest, time, 1.1);
                    if (step % 2 === 1) createQuantumHiss(audioCtxRef.current, dest, time, 0.03, 'white');
                    if (step % 4 !== 0) {
                        const osc = audioCtxRef.current.createOscillator();
                        const g = audioCtxRef.current.createGain();
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(step % 8 < 4 ? 50 : 45, time);
                        g.gain.setValueAtTime(0.15, time);
                        g.gain.exponentialRampToValueAtTime(0.001, time + secondsPerStep * 0.9);
                        osc.connect(g); g.connect(dest);
                        osc.start(time); osc.stop(time + secondsPerStep * 0.9);
                    }
                    break;

                case DecayMode.BETA_PLUS:
                    // Shivering Nervous Glitch (Original Style)
                    if (step % 8 === 0) createDeepKick(audioCtxRef.current, dest, time, 0.8);
                    if (step % 2 === 1) createQuantumHiss(audioCtxRef.current, dest, time, 0.03, 'white');
                    // Melodic nervous arpeggio
                    const bpScale = [1200, 1600, 880, 2200];
                    createStellarFM(audioCtxRef.current, dest, time, bpScale[step % 4], 0.08, 6 + Math.sin(step) * 4);
                    if (step % 4 === 0) createStellarFM(audioCtxRef.current, dest, time, 440, 0.1, 1);
                    break;

                case DecayMode.ELECTRON_CAPTURE:
                    // Black Hole / Singularity Suction
                    if (step % 16 === 0) createDeepKick(audioCtxRef.current, dest, time, 1.5); // Heavy sub kick
                    if (step % 8 === 0) createVoidSweep(audioCtxRef.current, dest, time, secondsPerStep * 6); // Suction
                    if (step % 4 === 2) createQuantumHiss(audioCtxRef.current, dest, time, 0.2, 'dark'); // Distant void noise
                    // Low gravity hum
                    if (step % 16 === 8) createStellarFM(audioCtxRef.current, dest, time, 35, 1.2, 10);
                    break;

                case DecayMode.ALPHA:
                    if (step % 8 === 0 || step % 8 === 4) createDeepKick(audioCtxRef.current, dest, time, 1.4);
                    if (step % 8 === 2 || step % 8 === 6) createQuantumHiss(audioCtxRef.current, dest, time, 0.1, 'dark');
                    if (step % 16 === 0) createStellarFM(audioCtxRef.current, dest, time, 40, 0.8, 8);
                    break;

                case DecayMode.SPONTANEOUS_FISSION:
                    createDeepKick(audioCtxRef.current, dest, time, 1.6);
                    createQuantumHiss(audioCtxRef.current, dest, time, 0.2, 'dark');
                    createStellarFM(audioCtxRef.current, dest, time, 20 + Math.random() * 800, 0.1, 25);
                    break;

                case DecayMode.PROTON_EMISSION:
                case DecayMode.NEUTRON_EMISSION:
                    if (step % 12 === 0) createDeepKick(audioCtxRef.current, dest, time, 0.6);
                    if (step % 16 === 8) createQuantumHiss(audioCtxRef.current, dest, time, 0.5, 'dark');
                    const droneFreq = primaryMode === DecayMode.PROTON_EMISSION ? 1800 : 32;
                    createStellarFM(audioCtxRef.current, dest, time, droneFreq, secondsPerStep * 3, 1);
                    break;

                default:
                    if (step % 4 === 0) createDeepKick(audioCtxRef.current, dest, time, 1.0);
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
            compressor.threshold.setValueAtTime(-26, ctx.currentTime);
            compressor.knee.setValueAtTime(30, ctx.currentTime);
            compressor.ratio.setValueAtTime(12, ctx.currentTime);
            compressor.attack.setValueAtTime(0.003, ctx.currentTime);
            compressor.release.setValueAtTime(0.25, ctx.currentTime);
            
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
        bpm: Math.round(126 + ((1 - hp / 100) * 34)), 
        primaryMode: getPrimaryMode() 
    };
};