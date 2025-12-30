
import { useEffect, useRef, useState, useCallback } from 'react';
import { DecayMode } from '../types';

export const useAudioEngine = (hp: number, isGameOver: boolean, decayModes: DecayMode[]) => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);
    const masterEntryRef = useRef<BiquadFilterNode | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const nextNoteTimeRef = useRef(0);
    const currentStepRef = useRef(0);
    const timerIDRef = useRef<number | null>(null);

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

    // --- High-End SF Synthesis Generators ---

    const createKick = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, mode: 'standard' | 'heavy-gabber' | 'sharp-gabber' | 'sub-thud' | 'dnb-punch' = 'standard') => {
        if (power <= 0) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const click = ctx.createOscillator();
        const clickGain = ctx.createGain();

        click.type = 'square';
        click.frequency.setValueAtTime(mode === 'dnb-punch' ? 5000 : 4000, time);
        click.frequency.exponentialRampToValueAtTime(100, time + 0.015);
        clickGain.gain.setValueAtTime(0.2 * power, time); 
        clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.015);
        
        osc.type = 'sine';
        const isGabber = mode.includes('gabber');
        const startFreq = mode === 'heavy-gabber' ? 65 : (mode === 'sharp-gabber' ? 95 : (mode === 'sub-thud' ? 45 : (mode === 'dnb-punch' ? 75 : 60)));
        const decayTime = isGabber ? 0.3 : (mode === 'sub-thud' ? 0.5 : (mode === 'dnb-punch' ? 0.18 : 0.35));
        
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(0.001, time + decayTime);
        
        // Safety: Balanced internal gain to prevent clipping before master chain
        gain.gain.setValueAtTime(0.8 * power, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

        if (isGabber) {
            const shaper = ctx.createWaveShaper();
            const curve = new Float32Array(44100);
            const dist = mode === 'heavy-gabber' ? 30 : 20; // Reduced for clarity
            for (let i = 0; i < 44100; i++) {
                const x = (i / 44100) * 2 - 1;
                curve[i] = (Math.PI + dist) * x / (Math.PI + dist * Math.abs(x));
            }
            shaper.curve = curve;
            osc.connect(shaper); shaper.connect(gain);
        } else {
            osc.connect(gain);
        }

        gain.connect(dest);
        click.connect(clickGain); clickGain.connect(dest);

        osc.start(time); osc.stop(time + decayTime);
        click.start(time); click.stop(time + 0.015);
    };

    const createSnare = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, color: 'sharp' | 'heavy' | 'industrial' | 'dnb-crack' = 'sharp') => {
        if (power <= 0) return;
        const noise = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = (color === 'industrial' || color === 'dnb-crack') ? 'highpass' : 'bandpass';
        filter.frequency.setValueAtTime(color === 'heavy' ? 800 : (color === 'industrial' ? 3500 : (color === 'dnb-crack' ? 1800 : 2200)), time);
        filter.Q.setValueAtTime(color === 'dnb-crack' ? 1.0 : 4.0, time);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime((color === 'dnb-crack' ? 0.7 : 0.5) * power, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + (color === 'dnb-crack' ? 0.1 : 0.15));

        noise.connect(filter); filter.connect(gain); gain.connect(dest);
        noise.start(time);
    };

    const createHat = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, weight: number = 1.0) => {
        if (power <= 0) return;
        const noise = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(12000, time);
        filter.Q.setValueAtTime(1.0, time);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12 * weight * power, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        noise.connect(filter); filter.connect(gain); gain.connect(dest);
        noise.start(time);
    };

    const createSynth = (ctx: AudioContext, dest: AudioNode, time: number, freq: number, duration: number, power: number = 1.0, type: 'pulse' | 'sub' | 'dark' | 'gabber' | 'void' | 'acid' | 'dnb-lead' = 'pulse') => {
        if (power <= 0) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const shaper = ctx.createWaveShaper();

        const curve = new Float32Array(44100);
        for (let i = 0; i < 44100; i++) {
            const x = (i / 44100) * 2 - 1;
            curve[i] = (Math.PI + 5) * x / (Math.PI + 5 * Math.abs(x));
        }
        shaper.curve = curve;

        osc.type = (type === 'gabber' || type === 'acid' || type === 'dnb-lead') ? 'sawtooth' : (type === 'void' ? 'sine' : (type === 'sub' ? 'sine' : (type === 'dark' ? 'sawtooth' : 'square')));
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        if (type === 'dark') {
            filter.frequency.setValueAtTime(freq * 3, time);
            filter.frequency.exponentialRampToValueAtTime(freq * 0.8, time + duration);
            filter.Q.setValueAtTime(4.0, time); // Reduced resonance to avoid 100-200Hz peaks
        } else if (type === 'gabber') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(freq * 8, time);
            filter.frequency.exponentialRampToValueAtTime(freq * 1.5, time + duration);
            filter.Q.setValueAtTime(8, time); 
        } else if (type === 'acid') {
            filter.frequency.setValueAtTime(freq * 10, time);
            filter.frequency.exponentialRampToValueAtTime(freq * 0.8, time + duration);
            filter.Q.setValueAtTime(12, time);
        } else if (type === 'dnb-lead') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(freq * 12, time);
            filter.frequency.exponentialRampToValueAtTime(freq * 24, time + duration);
            filter.Q.setValueAtTime(15, time); 
        } else if (type === 'void') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(freq * 2, time);
            filter.Q.setValueAtTime(3, time);
        } else {
            filter.frequency.setValueAtTime(2500, time);
            filter.Q.setValueAtTime(2, time);
        }

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime((type === 'sub' ? 0.3 : (type === 'gabber' ? 0.2 : (type === 'void' ? 0.2 : 0.15))) * power, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(shaper); shaper.connect(filter); filter.connect(gain); gain.connect(dest);
        osc.start(time); osc.stop(time + duration);
    };

    // --- Core Rhythm Logic ---
    const playRhythm = (mode: DecayMode, ctx: AudioContext, dest: AudioNode, time: number, step: number, power: number, secondsPerStep: number) => {
        if (power <= 0) return;

        let isKickStep = (step % 4 === 0);
        const sidechainFactor = isKickStep ? 0.35 : 1.0; 
        const synthPower = power * sidechainFactor;

        switch (mode) {
            case DecayMode.STABLE:
                if (step % 4 === 0) createKick(ctx, dest, time, 0.8 * power);
                if (step % 4 === 2) createHat(ctx, dest, time, power, 0.6);
                if (step % 8 === 6) createHat(ctx, dest, time, power * 1.2, 1.0);
                if (step % 16 === 14) createSynth(ctx, dest, time, 2637, 0.05, 0.2 * synthPower, 'pulse');
                break;

            case DecayMode.BETA_MINUS:
                if (step % 4 === 0) createKick(ctx, dest, time, 1.1 * power, 'standard');
                if (step === 4 || step === 12) createSnare(ctx, dest, time, 0.8 * power, 'sharp');
                if (step % 4 === 2) {
                    createHat(ctx, dest, time, power * 1.6, 1.5); 
                } else {
                    createHat(ctx, dest, time, power * 0.4, 0.5); 
                }
                if ([2, 3, 6, 7, 10, 11, 14, 15].includes(step)) {
                    const bassFreq = (step % 8 < 4) ? 55 : 41.2; 
                    createSynth(ctx, dest, time, bassFreq, secondsPerStep * 0.7, 0.85 * synthPower, 'dark');
                }
                if (step === 10) {
                    createSynth(ctx, dest, time, 880, 0.04, 0.4 * synthPower, 'pulse');
                }
                break;

            case DecayMode.BETA_PLUS:
                if ([0, 3, 6, 9, 13].includes(step)) createKick(ctx, dest, time, 1.0 * power);
                if (step === 4 || step === 12) createSnare(ctx, dest, time, 0.7 * power, 'sharp');
                if (step % 2 === 1) createHat(ctx, dest, time, power, 1.0);
                if (step % 16 === 7) createSynth(ctx, dest, time, 440, 0.15, 0.7 * synthPower, 'pulse');
                break;

            case DecayMode.ELECTRON_CAPTURE:
                if ([1, 4, 7, 10, 14].includes(step)) createKick(ctx, dest, time, 1.2 * power);
                if (step === 2 || step === 11) createSnare(ctx, dest, time, 0.7 * power, 'heavy');
                if (step % 8 === 4) createSynth(ctx, dest, time, 110, secondsPerStep * 2.5, 0.8 * synthPower, 'acid');
                createHat(ctx, dest, time, power, step % 4 === 0 ? 0.3 : 0.7);
                if (step % 8 === 0) createSynth(ctx, dest, time, 41.2, secondsPerStep * 4, 0.9 * synthPower, 'dark');
                break;

            case DecayMode.ALPHA:
                if (step === 0 || step === 10) createKick(ctx, dest, time, 1.1 * power, 'dnb-punch');
                if (step === 4 || step === 12) {
                    createSnare(ctx, dest, time, 1.2 * power, 'dnb-crack');
                } else if ([2, 6, 7, 14, 15].includes(step)) {
                    createSnare(ctx, dest, time, 0.2 * power, 'sharp');
                }
                createHat(ctx, dest, time, power * (step % 2 === 0 ? 0.8 : 0.4), 1.1);
                if (step % 4 === 2) createHat(ctx, dest, time, power * 1.3, 1.5);
                const alphaBassFreq = step % 8 < 4 ? 41.2 : 38.8; 
                createSynth(ctx, dest, time, alphaBassFreq, secondsPerStep * 2.5, 1.0 * synthPower, 'dark');
                if (step % 4 === 1) {
                    createSynth(ctx, dest, time, 1760 + (Math.sin(time * 10) * 440), 0.04, 0.4 * synthPower, 'dnb-lead');
                }
                if (step % 8 === 3) {
                    createSynth(ctx, dest, time, 3520, 0.08, 0.2 * synthPower, 'pulse');
                }
                break;

            case DecayMode.SPONTANEOUS_FISSION:
                createKick(ctx, dest, time, 1.3 * power, 'heavy-gabber');
                createSnare(ctx, dest, time, power * 1.0, 'industrial');
                createSynth(ctx, dest, time, 35 + Math.random() * 100, 0.1, 1.2 * synthPower, 'gabber');
                break;

            case DecayMode.NEUTRON_EMISSION:
                if (step % 4 === 0) createKick(ctx, dest, time, 1.2 * power, 'heavy-gabber');
                if (step % 8 === 2 || step % 8 === 6) createSnare(ctx, dest, time, power * 1.1, 'industrial');
                if (step % 4 !== 0) {
                    createSynth(ctx, dest, time, 41.2, secondsPerStep * 2, 0.8 * synthPower, 'dark');
                    if (Math.random() > 0.6) createHat(ctx, dest, time, power, 1.8);
                }
                break;

            case DecayMode.PROTON_EMISSION:
                if (step % 2 === 0) createKick(ctx, dest, time, 1.2 * power, 'sharp-gabber');
                if (step % 2 === 1) createHat(ctx, dest, time, power * 1.4, 2.0);
                const pScreech = 2000 + (Math.random() * 3000);
                if (step % 4 === 1) createSynth(ctx, dest, time, pScreech, 0.06, 0.7 * synthPower, 'gabber');
                break;

            case DecayMode.UNKNOWN:
                if (step % 16 === 0) {
                    const ambientDrone = 32.70 + (Math.sin(time * 0.2) * 2); 
                    createSynth(ctx, dest, time, ambientDrone, secondsPerStep * 20, 0.3 * power, 'void');
                }
                if (step % 12 === 0) {
                    const harmonicFreq = 130.81 * (Math.floor(Math.random() * 4) + 1);
                    createSynth(ctx, dest, time, harmonicFreq, secondsPerStep * 10, 0.1 * power, 'void');
                }
                if (Math.random() > 0.97) {
                    const glitchFreq = 3000 + (Math.random() * 5000);
                    createSynth(ctx, dest, time, glitchFreq, 0.6, 0.05 * power, 'pulse');
                }
                break;

            default:
                if (step % 4 === 0) createKick(ctx, dest, time, 0.8 * power);
                break;
        }
    };

    const scheduler = useCallback(() => {
        if (!audioCtxRef.current || !masterEntryRef.current) return;
        
        const hpFactor = 1.0 - (hpRef.current / 100);
        const baseBpm = 132;
        const currentBpm = baseBpm + (hpFactor * 32); 
        const secondsPerStep = 60 / currentBpm / 4;

        while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.1) {
            const time = nextNoteTimeRef.current;
            const step = currentStepRef.current;
            const targetMode = getPrimaryMode(decayModesRef.current);
            const ctx = audioCtxRef.current;
            const dest = masterEntryRef.current;

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

            // --- MASTER SIGNAL CHAIN FOR CLARITY ---
            
            // 1. High Pass Filter (Sub-bass cut < 40Hz)
            const hpFilter = ctx.createBiquadFilter();
            hpFilter.type = 'highpass';
            hpFilter.frequency.setValueAtTime(42, ctx.currentTime);

            // 2. Correction EQ (Dip boxy/muddy frequencies @ 160Hz)
            const eqFilter = ctx.createBiquadFilter();
            eqFilter.type = 'peaking';
            eqFilter.frequency.setValueAtTime(160, ctx.currentTime);
            eqFilter.Q.setValueAtTime(0.8, ctx.currentTime); // Broad bandwidth
            eqFilter.gain.setValueAtTime(-5.0, ctx.currentTime); // Attenuate problematic range

            // 3. Dynamics Compressor (Musical settings)
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-22, ctx.currentTime);
            compressor.knee.setValueAtTime(15, ctx.currentTime);
            compressor.ratio.setValueAtTime(6, ctx.currentTime); 
            compressor.attack.setValueAtTime(0.005, ctx.currentTime);
            compressor.release.setValueAtTime(0.18, ctx.currentTime);
            
            // 4. Final Master Gain with safe headroom
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.65, ctx.currentTime); 

            // Connect: HP -> EQ -> Compressor -> MasterGain -> Destination
            hpFilter.connect(eqFilter);
            eqFilter.connect(compressor);
            compressor.connect(masterGain);
            masterGain.connect(ctx.destination);

            masterEntryRef.current = hpFilter;
            masterGainRef.current = masterGain;
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    }, []);

    const toggleMute = () => {
        if (isMuted) {
            initAudio();
            if (audioCtxRef.current) {
                nextNoteTimeRef.current = audioCtxRef.current.currentTime;
                if (!timerIDRef.current) scheduler();
                setIsMuted(false);
            }
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
