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

    // --- Transition State Refs ---
    const lastModeRef = useRef<DecayMode | null>(null);
    const transitionFromModeRef = useRef<DecayMode | null>(null);
    const transitionProgressRef = useRef(1.0); 
    const TRANSITION_STEPS = 16; 

    const hpRef = useRef(hp);
    const decayModesRef = useRef(decayModes);

    useEffect(() => {
        hpRef.current = hp;
        decayModesRef.current = decayModes;
    }, [hp, decayModes]);

    const getPrimaryMode = (modes: DecayMode[]) => {
        return modes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) 
               || (modes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : DecayMode.STABLE);
    };

    // --- High-Fidelity SF Synthesis Generators ---

    const createKick = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, mode: 'standard' | 'heavy-gabber' | 'sharp-gabber' | 'sub-thud' = 'standard') => {
        if (power <= 0) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        
        const isGabber = mode.includes('gabber');
        const startFreq = mode === 'heavy-gabber' ? 48 : (mode === 'sharp-gabber' ? 90 : (mode === 'sub-thud' ? 40 : 55));
        const decayTime = isGabber ? 0.28 : (mode === 'sub-thud' ? 0.6 : 0.4);
        
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(0.001, time + decayTime);
        
        gain.gain.setValueAtTime(0.95 * power, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

        if (isGabber) {
            const shaper = ctx.createWaveShaper();
            const curve = new Float32Array(44100);
            const dist = mode === 'heavy-gabber' ? 45 : 30; 
            for (let i = 0; i < 44100; i++) {
                const x = (i / 44100) * 2 - 1;
                curve[i] = (Math.PI + dist) * x / (Math.PI + dist * Math.abs(x));
            }
            shaper.curve = curve;
            osc.connect(shaper); shaper.connect(gain);
            
            const click = ctx.createOscillator();
            const clickGain = ctx.createGain();
            click.type = 'square';
            click.frequency.setValueAtTime(mode === 'sharp-gabber' ? 5000 : 2500, time);
            click.frequency.exponentialRampToValueAtTime(100, time + 0.02);
            clickGain.gain.setValueAtTime(0.25 * power, time);
            clickGain.gain.linearRampToValueAtTime(0, time + 0.02);
            click.connect(clickGain); clickGain.connect(dest);
            click.start(time); click.stop(time + 0.03);
        } else {
            const click = ctx.createOscillator();
            const clickGain = ctx.createGain();
            click.type = 'square';
            click.frequency.setValueAtTime(3500, time);
            clickGain.gain.setValueAtTime(0.18 * power, time);
            clickGain.gain.linearRampToValueAtTime(0, time + 0.005);
            click.connect(clickGain); clickGain.connect(dest);
            click.start(time); click.stop(time + 0.01);
            osc.connect(gain);
        }

        gain.connect(dest);
        osc.start(time); osc.stop(time + decayTime);
    };

    const createSnare = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, color: 'sharp' | 'heavy' | 'industrial' = 'sharp') => {
        if (power <= 0) return;
        const noise = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = color === 'industrial' ? 'highpass' : 'bandpass';
        filter.frequency.setValueAtTime(color === 'heavy' ? 750 : (color === 'industrial' ? 3200 : 1900), time);
        filter.Q.setValueAtTime(2.5, time); 
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5 * power, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

        noise.connect(filter); filter.connect(gain); gain.connect(dest);
        noise.start(time);
    };

    const createHat = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, weight: number = 1.0) => {
        if (power <= 0) return;
        const noise = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(12000, time);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12 * weight * power, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

        noise.connect(filter); filter.connect(gain); gain.connect(dest);
        noise.start(time);
    };

    const createSynth = (ctx: AudioContext, dest: AudioNode, time: number, freq: number, duration: number, power: number = 1.0, type: 'pulse' | 'sub' | 'dark' | 'gabber' | 'void' = 'pulse') => {
        if (power <= 0) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = type === 'gabber' ? 'sawtooth' : (type === 'void' ? 'sine' : (type === 'sub' ? 'sine' : (type === 'dark' ? 'sawtooth' : 'square')));
        osc.frequency.setValueAtTime(freq, time);

        let mod: OscillatorNode | null = null;
        if (type === 'gabber' || type === 'void') {
            mod = ctx.createOscillator();
            mod.type = type === 'void' ? 'triangle' : 'sine';
            mod.frequency.setValueAtTime(freq * 1.5, time); 
            mod.connect(filter);
        }

        filter.type = 'lowpass';
        if (type === 'dark') {
            filter.frequency.setValueAtTime(freq * 4, time);
            filter.frequency.exponentialRampToValueAtTime(freq * 0.4, time + duration);
            filter.Q.setValueAtTime(8, time); 
        } else if (type === 'gabber') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(freq * 6, time);
            filter.frequency.exponentialRampToValueAtTime(freq, time + duration);
            filter.Q.setValueAtTime(18, time); 
        } else if (type === 'void') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(freq * 2, time);
            filter.Q.setValueAtTime(2, time);
        } else {
            filter.frequency.setValueAtTime(2200, time);
            filter.Q.setValueAtTime(1, time);
        }

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime((type === 'sub' ? 0.35 : (type === 'gabber' ? 0.24 : (type === 'void' ? 0.2 : 0.18))) * power, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter); filter.connect(gain); gain.connect(dest);
        osc.start(time); osc.stop(time + duration);
        if (mod) { mod.start(time); mod.stop(time + duration); }
    };

    // --- Core Rhythm Logic with Pseudo-Sidechain ---
    const playRhythm = (mode: DecayMode, ctx: AudioContext, dest: AudioNode, time: number, step: number, power: number, secondsPerStep: number) => {
        if (power <= 0) return;

        // --- Sidechain Calculation ---
        let isKickStep = false;
        switch (mode) {
            case DecayMode.STABLE: isKickStep = (step % 4 === 0); break;
            case DecayMode.BETA_MINUS: isKickStep = (step % 4 === 0); break;
            case DecayMode.BETA_PLUS: isKickStep = [0, 3, 6, 9, 13].includes(step); break;
            case DecayMode.ELECTRON_CAPTURE: isKickStep = [1, 4, 7, 10, 14].includes(step); break;
            case DecayMode.ALPHA: isKickStep = (step === 0 || step === 10); break;
            case DecayMode.SPONTANEOUS_FISSION: isKickStep = true; break;
            case DecayMode.NEUTRON_EMISSION: isKickStep = (step % 4 === 0); break;
            case DecayMode.PROTON_EMISSION: isKickStep = (step % 2 === 0); break;
            case DecayMode.UNKNOWN: isKickStep = false; break; // No pumping in ambient
        }

        const sidechainFactor = isKickStep ? 0.35 : 1.0; 
        const synthPower = power * sidechainFactor;

        switch (mode) {
            case DecayMode.STABLE:
                if (step % 4 === 0) createKick(ctx, dest, time, 0.8 * power);
                if (step % 4 === 2) createHat(ctx, dest, time, power, 0.4);
                if (step % 8 === 6) createHat(ctx, dest, time, power, 0.9);
                if (step % 16 === 14) createSynth(ctx, dest, time, 220, 0.15, 0.8 * synthPower, 'pulse');
                break;

            case DecayMode.BETA_MINUS:
                if (step % 4 === 0) createKick(ctx, dest, time, 1.2 * power);
                if (step === 4 || step === 12) createSnare(ctx, dest, time, power, 'industrial');
                createHat(ctx, dest, time, power, step % 2 === 0 ? 0.3 : 0.8);
                if (step % 4 !== 0) {
                    const bassFreq = (step % 8 < 4) ? 55 : 73.4;
                    createSynth(ctx, dest, time, bassFreq, secondsPerStep * 1.5, 1.1 * synthPower, 'dark');
                }
                break;

            case DecayMode.BETA_PLUS:
                if ([0, 3, 6, 9, 13].includes(step)) createKick(ctx, dest, time, 1.1 * power);
                if (step === 4 || step === 12) createSnare(ctx, dest, time, power, 'sharp');
                if (step % 2 === 1) createHat(ctx, dest, time, power, 1.0);
                if (step % 16 === 7) createSynth(ctx, dest, time, 880, 0.1, 0.6 * synthPower, 'pulse');
                break;

            case DecayMode.ELECTRON_CAPTURE:
                if ([1, 4, 7, 10, 14].includes(step)) createKick(ctx, dest, time, 1.4 * power);
                if (step === 2 || step === 11) createSnare(ctx, dest, time, power, 'heavy');
                if (step % 8 === 4) createSynth(ctx, dest, time, 110, secondsPerStep * 2.5, 0.8 * synthPower, 'dark');
                createHat(ctx, dest, time, power, step % 4 === 0 ? 0.3 : 0.7);
                if (step % 8 === 0) createSynth(ctx, dest, time, 41.2, secondsPerStep * 4, 1.0 * synthPower, 'dark');
                break;

            case DecayMode.ALPHA:
                if (step === 0 || step === 10) createKick(ctx, dest, time, 1.3 * power);
                if (step === 4 || step === 12) createSnare(ctx, dest, time, power, 'heavy');
                createHat(ctx, dest, time, power, 1.2);
                const reeseFreq = step % 8 < 4 ? 61.7 : 58.2; 
                createSynth(ctx, dest, time, reeseFreq, secondsPerStep * 3, 1.1 * synthPower, 'dark');
                break;

            case DecayMode.SPONTANEOUS_FISSION:
                createKick(ctx, dest, time, 1.8 * power, 'heavy-gabber');
                createSnare(ctx, dest, time, power, 'industrial');
                createSynth(ctx, dest, time, 35 + Math.random() * 90, 0.1, 1.3 * synthPower, 'dark');
                break;

            case DecayMode.NEUTRON_EMISSION:
                if (step % 4 === 0) createKick(ctx, dest, time, 1.6 * power, 'heavy-gabber');
                if (step % 8 === 2 || step % 8 === 6) createSnare(ctx, dest, time, power * 1.2, 'industrial');
                if (step % 4 !== 0) {
                    createSynth(ctx, dest, time, 41.2, secondsPerStep * 2, 0.9 * synthPower, 'dark');
                    if (Math.random() > 0.6) createHat(ctx, dest, time, power, 1.6);
                }
                break;

            case DecayMode.PROTON_EMISSION:
                if (step % 2 === 0) createKick(ctx, dest, time, 1.4 * power, 'sharp-gabber');
                if (step % 2 === 1) createHat(ctx, dest, time, power * 1.8, 2.2);
                const pScreech = 2500 + (Math.random() * 2000);
                if (step % 4 === 1) createSynth(ctx, dest, time, pScreech, 0.05, 0.8 * synthPower, 'gabber');
                break;

            case DecayMode.UNKNOWN:
                // Silent Experimental Ambient Mode
                if (step === 0) createKick(ctx, dest, time, 0.3 * power, 'sub-thud'); // Soft heartbeat
                // Constant morphing drone
                if (step % 8 === 0) {
                    const droneFreq = 48.99 + (Math.sin(time) * 5); // G1 with subtle pitch drift
                    createSynth(ctx, dest, time, droneFreq, secondsPerStep * 16, 0.35 * power, 'void');
                }
                // Rare crystalline sparkle
                if (Math.random() > 0.96) {
                    createSynth(ctx, dest, time, 3000 + Math.random() * 2000, 0.8, 0.15 * power, 'pulse');
                }
                break;

            default:
                if (step % 4 === 0) createKick(ctx, dest, time, 1.0 * power);
                break;
        }
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
            const targetMode = getPrimaryMode(decayModesRef.current);
            const ctx = audioCtxRef.current;
            const dest = compressorRef.current;

            if (lastModeRef.current !== null && lastModeRef.current !== targetMode && transitionProgressRef.current >= 1.0) {
                transitionFromModeRef.current = lastModeRef.current;
                transitionProgressRef.current = 0.0;
            }
            lastModeRef.current = targetMode;

            if (transitionProgressRef.current < 1.0) {
                const factor = transitionProgressRef.current;
                if (transitionFromModeRef.current) {
                    playRhythm(transitionFromModeRef.current, ctx, dest, time, step, (1.0 - factor), secondsPerStep);
                }
                playRhythm(targetMode, ctx, dest, time, step, factor, secondsPerStep);
                transitionProgressRef.current += (1.0 / TRANSITION_STEPS);
            } else {
                playRhythm(targetMode, ctx, dest, time, step, 1.0, secondsPerStep);
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
            compressor.threshold.setValueAtTime(-22, ctx.currentTime);
            compressor.knee.setValueAtTime(8, ctx.currentTime);
            compressor.ratio.setValueAtTime(15, ctx.currentTime);
            compressor.attack.setValueAtTime(0.002, ctx.currentTime);
            compressor.release.setValueAtTime(0.08, ctx.currentTime);
            
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.7, ctx.currentTime);

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
        primaryMode: getPrimaryMode(decayModesRef.current) 
    };
};