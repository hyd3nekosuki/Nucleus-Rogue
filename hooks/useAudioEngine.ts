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

    const getPrimaryMode = (modes: DecayMode[]) => {
        return modes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) 
               || (modes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : DecayMode.STABLE);
    };

    // --- Transition Management ---
    const lastModeRef = useRef<DecayMode | null>(null);
    const transitionFromModeRef = useRef<DecayMode | null>(null);
    
    // Settling Logic (Debounce) to ignore intermediate states during rapid transformations
    const stablePrimaryModeRef = useRef<DecayMode>(getPrimaryMode(decayModes));
    const debounceTimerRef = useRef<number | null>(null);

    // Progress trackers for independent fade speeds
    const foundationProgressRef = useRef(1.0);  // Fast (4 steps)
    const ornamentalInProgressRef = useRef(1.0); // Medium-Fast (8 steps)
    const ornamentalOutProgressRef = useRef(1.0); // Slow (16 steps)
    
    const F_STEP = 1.0 / 4;
    const O_IN_STEP = 1.0 / 8;
    const O_OUT_STEP = 1.0 / 16;

    const hpRef = useRef(hp);
    const decayModesRef = useRef(decayModes);

    // Synchronize HP in real-time for BPM updates
    useEffect(() => {
        hpRef.current = hp;
    }, [hp]);

    // Synchronize decayModes and manage "Settling Time" (Debounce) for BGM pattern switching
    useEffect(() => {
        decayModesRef.current = decayModes;
        const currentPrimary = getPrimaryMode(decayModes);

        if (currentPrimary !== stablePrimaryModeRef.current) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = window.setTimeout(() => {
                stablePrimaryModeRef.current = currentPrimary;
                debounceTimerRef.current = null;
            }, 200); 
        } else {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
        }
    }, [decayModes]);

    // --- Synthesis Generators ---
    const createKick = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, mode: 'standard' | 'heavy-gabber' | 'sharp-gabber' | 'sub-thud' | 'dnb-punch' = 'standard') => {
        if (power <= 0.001) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const click = ctx.createOscillator();
        const clickGain = ctx.createGain();

        click.type = 'square';
        click.frequency.setValueAtTime(mode === 'dnb-punch' ? 6000 : 4500, time);
        click.frequency.exponentialRampToValueAtTime(150, time + 0.02);
        clickGain.gain.setValueAtTime(0, time);
        clickGain.gain.linearRampToValueAtTime(0.22 * power, time + 0.002); 
        clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
        clickGain.gain.linearRampToValueAtTime(0, time + 0.025); 
        
        osc.type = 'sine';
        const isGabber = mode.includes('gabber');
        const startFreq = mode === 'heavy-gabber' ? 68 : (mode === 'sharp-gabber' ? 98 : (mode === 'sub-thud' ? 48 : (mode === 'dnb-punch' ? 78 : 64)));
        const decayTime = isGabber ? 0.35 : (mode === 'sub-thud' ? 0.55 : (mode === 'dnb-punch' ? 0.22 : 0.38));
        
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(1, time + decayTime);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.7 * power, time + 0.005); 
        gain.gain.exponentialRampToValueAtTime(0.0001, time + decayTime);
        gain.gain.linearRampToValueAtTime(0, time + decayTime + 0.015); 

        if (isGabber) {
            const shaper = ctx.createWaveShaper();
            const curve = new Float32Array(44100);
            const dist = mode === 'heavy-gabber' ? 25 : 15;
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

        osc.start(time); osc.stop(time + decayTime + 0.05);
        click.start(time); click.stop(time + 0.05);
    };

    const createSnare = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, color: 'sharp' | 'heavy' | 'industrial' | 'dnb-crack' = 'sharp') => {
        if (power <= 0.001) return;
        const noise = ctx.createBufferSource();
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = (color === 'industrial' || color === 'dnb-crack') ? 'highpass' : 'bandpass';
        filter.frequency.setValueAtTime(color === 'heavy' ? 800 : (color === 'industrial' ? 3500 : (color === 'dnb-crack' ? 1800 : 2200)), time);
        filter.Q.setValueAtTime(color === 'dnb-crack' ? 1.0 : 4.0, time);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime((color === 'dnb-crack' ? 0.5 : 0.35) * power, time + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + (color === 'dnb-crack' ? 0.12 : 0.15));
        gain.gain.linearRampToValueAtTime(0, time + (color === 'dnb-crack' ? 0.15 : 0.18));

        noise.connect(filter); filter.connect(gain); gain.connect(dest);
        noise.start(time); noise.stop(time + 0.2);
    };

    const createHat = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, weight: number = 1.0) => {
        if (power <= 0.001) return;
        const noise = ctx.createBufferSource();
        const bufferSize = ctx.sampleRate * 0.08;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(11500, time);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.09 * weight * power, time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
        gain.gain.linearRampToValueAtTime(0, time + 0.08);

        noise.connect(filter); filter.connect(gain); gain.connect(dest);
        noise.start(time); noise.stop(time + 0.1);
    };

    const createSynth = (ctx: AudioContext, dest: AudioNode, time: number, freq: number, duration: number, power: number = 1.0, type: 'pulse' | 'sub' | 'dark' | 'gabber' | 'void' | 'acid' | 'dnb-lead' | 'sparkle' = 'pulse') => {
        if (power <= 0.001) return;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const panner = ctx.createStereoPanner();

        osc1.type = (type === 'gabber' || type === 'acid' || type === 'dnb-lead' || type === 'sparkle') ? 'sawtooth' : (type === 'void' ? 'sine' : (type === 'sub' ? 'sine' : (type === 'dark' ? 'sawtooth' : 'square')));
        osc2.type = osc1.type;
        osc1.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(freq * 1.005, time);

        filter.type = 'lowpass';
        filter.Q.setValueAtTime(3.5, time);

        if (type === 'dark') {
            filter.frequency.setValueAtTime(freq * 3.0, time);
            filter.frequency.exponentialRampToValueAtTime(freq * 0.8, time + duration);
        } else if (type === 'gabber') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(freq * 6, time);
            filter.Q.setValueAtTime(8, time);
        } else if (type === 'sparkle') {
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(3500, time);
            panner.pan.setValueAtTime(Math.sin(time * 10) * 0.3, time);
        } else if (type === 'dnb-lead') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(freq * 10, time);
            filter.frequency.exponentialRampToValueAtTime(freq * 20, time + duration);
        } else if (type === 'void') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(freq * 1.2, time);
        } else {
            filter.frequency.setValueAtTime(2800, time);
        }

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.16 * power, time + 0.008); 
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        gain.gain.linearRampToValueAtTime(0, time + duration + 0.015); 

        osc1.connect(filter); osc2.connect(filter); 
        filter.connect(panner); panner.connect(gain); gain.connect(dest);
        
        osc1.start(time); osc1.stop(time + duration + 0.05);
        osc2.start(time); osc2.stop(time + duration + 0.05);
    };

    const playRhythm = (mode: DecayMode, ctx: AudioContext, dest: AudioNode, time: number, step: number, fP: number, oP: number, secondsPerStep: number) => {
        const sidechain = (step % 4 === 0) ? 0.45 : 1.0; 
        const sf = fP * sidechain;
        const so = oP * sidechain;

        switch (mode) {
            case DecayMode.STABLE:
                if (step % 4 === 0) createKick(ctx, dest, time, 0.8 * fP);
                if (step % 4 === 2) createHat(ctx, dest, time, oP, 0.8);
                if (step % 8 === 6) createHat(ctx, dest, time, oP * 1.1, 1.1);
                if (step % 16 === 14) createSynth(ctx, dest, time, 2637, 0.08, 0.2 * so, 'pulse');
                break;
            case DecayMode.BETA_MINUS:
                if (step % 4 === 0) createKick(ctx, dest, time, 1.0 * fP, 'standard');
                if ([2, 3, 6, 7, 10, 11, 14, 15].includes(step)) createSynth(ctx, dest, time, (step % 8 < 4) ? 55 : 41.2, secondsPerStep * 0.75, 0.8 * sf, 'dark');
                if (step === 4 || step === 12) createSnare(ctx, dest, time, 0.7 * oP, 'sharp');
                if (step % 4 === 2) createHat(ctx, dest, time, oP * 1.4, 1.4);
                break;
            case DecayMode.BETA_PLUS:
                if ([0, 3, 6, 9, 13].includes(step)) createKick(ctx, dest, time, 0.9 * fP);
                if (step === 4 || step === 12) createSnare(ctx, dest, time, 0.6 * oP, 'sharp');
                if (step % 2 === 1) createHat(ctx, dest, time, oP, 1.1);
                if (step % 16 === 7) createSynth(ctx, dest, time, 880, 0.2, 0.6 * so, 'sparkle');
                break;
            case DecayMode.ELECTRON_CAPTURE:
                if ([1, 4, 7, 10, 14].includes(step)) createKick(ctx, dest, time, 1.0 * fP);
                if (step % 8 === 0) createSynth(ctx, dest, time, 41.2, secondsPerStep * 4, 0.85 * sf, 'dark');
                if (step === 2 || step === 11) createSnare(ctx, dest, time, 0.6 * oP, 'heavy');
                if (step % 8 === 4) createSynth(ctx, dest, time, 110, secondsPerStep * 2.5, 0.7 * so, 'acid');
                createHat(ctx, dest, time, oP, step % 4 === 0 ? 0.4 : 0.8);
                break;
            case DecayMode.ALPHA:
                if (step === 0 || step === 10) createKick(ctx, dest, time, 0.95 * fP, 'dnb-punch');
                createSynth(ctx, dest, time, step % 8 < 4 ? 41.2 : 38.8, secondsPerStep * 2.5, 0.9 * sf, 'dark');
                if (step === 4 || step === 12) createSnare(ctx, dest, time, 1.0 * oP, 'dnb-crack');
                createHat(ctx, dest, time, oP * (step % 2 === 0 ? 0.9 : 0.5), 1.1);
                if (step % 4 === 1) createSynth(ctx, dest, time, 1760, 0.05, 0.3 * so, 'dnb-lead');
                break;
            case DecayMode.SPONTANEOUS_FISSION:
                createKick(ctx, dest, time, 1.2 * fP, 'heavy-gabber');
                createSnare(ctx, dest, time, oP * 0.85, 'industrial');
                createSynth(ctx, dest, time, 40 + Math.random() * 80, 0.15, 1.0 * so, 'gabber');
                break;
            case DecayMode.NEUTRON_EMISSION:
                if (step % 4 === 0) createKick(ctx, dest, time, 1.15 * fP, 'heavy-gabber');
                if (step % 4 !== 0) createSynth(ctx, dest, time, 41.2, secondsPerStep * 2, 0.7 * sf, 'dark');
                if (step % 8 === 2 || step % 8 === 6) createSnare(ctx, dest, time, oP * 0.9, 'industrial');
                if (Math.random() > 0.6) createHat(ctx, dest, time, oP, 1.7);
                break;
            case DecayMode.PROTON_EMISSION:
                if (step % 4 === 0) createKick(ctx, dest, time, 0.95 * fP, 'dnb-punch');
                if (step % 4 === 2) createHat(ctx, dest, time, oP * 1.4, 1.3);
                if (step % 2 === 1) createHat(ctx, dest, time, oP * 0.7, 0.9);
                if ([0, 3, 6, 10, 13].includes(step)) createSynth(ctx, dest, time, [1760, 2637, 3520][step % 3], 0.1, 0.4 * so, 'sparkle');
                if (step === 15) for(let i = 0; i < 4; i++) createSynth(ctx, dest, time + (i * 0.025), 3520 + (i * 440), 0.03, 0.16 * so, 'pulse');
                break;
            case DecayMode.UNKNOWN:
                if (step % 16 === 0) createSynth(ctx, dest, time, 32.7, secondsPerStep * 20, 0.25 * sf, 'void');
                if (Math.random() > 0.97) createSynth(ctx, dest, time, 4000, 0.5, 0.08 * so, 'pulse');
                break;
            default:
                if (step % 4 === 0) createKick(ctx, dest, time, 0.7 * fP);
                break;
        }
    };

    const scheduler = useCallback(() => {
        if (!audioCtxRef.current || !masterEntryRef.current) return;
        
        const hpFactor = 1.0 - (hpRef.current / 100);
        const currentBpm = 132 + (hpFactor * 32); 
        const secondsPerStep = 60 / currentBpm / 4;

        while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.1) {
            const time = nextNoteTimeRef.current;
            const step = currentStepRef.current;
            const ctx = audioCtxRef.current;
            const dest = masterEntryRef.current;

            const targetMode = stablePrimaryModeRef.current;

            if (lastModeRef.current !== null && lastModeRef.current !== targetMode) {
                transitionFromModeRef.current = lastModeRef.current;
                foundationProgressRef.current = 0.0;
                ornamentalInProgressRef.current = 0.0;
                ornamentalOutProgressRef.current = 0.0;
            }
            lastModeRef.current = targetMode;

            const isTransitioning = (foundationProgressRef.current < 1.0 || ornamentalInProgressRef.current < 1.0 || ornamentalOutProgressRef.current < 1.0);

            if (isTransitioning) {
                if (transitionFromModeRef.current) {
                    const fOut = Math.max(0, 1.0 - foundationProgressRef.current);
                    const oOut = Math.max(0, 1.0 - ornamentalOutProgressRef.current);
                    playRhythm(transitionFromModeRef.current, ctx, dest, time, step, fOut, oOut, secondsPerStep);
                }
                const fIn = Math.min(1.0, foundationProgressRef.current);
                const oIn = Math.min(1.0, ornamentalInProgressRef.current);
                playRhythm(targetMode, ctx, dest, time, step, fIn, oIn, secondsPerStep);

                foundationProgressRef.current = Math.min(1.0, foundationProgressRef.current + F_STEP);
                ornamentalInProgressRef.current = Math.min(1.0, ornamentalInProgressRef.current + O_IN_STEP);
                ornamentalOutProgressRef.current = Math.min(1.0, ornamentalOutProgressRef.current + O_OUT_STEP);
            } else {
                playRhythm(targetMode, ctx, dest, time, step, 1.0, 1.0, secondsPerStep);
            }

            nextNoteTimeRef.current += secondsPerStep;
            currentStepRef.current = (currentStepRef.current + 1) % 16;
        }
        timerIDRef.current = window.setTimeout(scheduler, 25);
    }, []);

    const initAudio = useCallback(() => {
        // ALWAYS perform a clean build if requested or if none exists
        if (audioCtxRef.current) {
            try {
                audioCtxRef.current.close().catch(() => {});
            } catch(e) {}
            audioCtxRef.current = null;
        }

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;

        const hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.setValueAtTime(45, ctx.currentTime);

        const eqFilter = ctx.createBiquadFilter();
        eqFilter.type = 'peaking';
        eqFilter.frequency.setValueAtTime(180, ctx.currentTime);
        eqFilter.gain.setValueAtTime(-5.5, ctx.currentTime); 

        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-10, ctx.currentTime);
        limiter.knee.setValueAtTime(3, ctx.currentTime); 
        limiter.ratio.setValueAtTime(20.0, ctx.currentTime);
        limiter.attack.setValueAtTime(0.002, ctx.currentTime);
        limiter.release.setValueAtTime(0.08, ctx.currentTime);
        
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.42, ctx.currentTime); 

        hpFilter.connect(eqFilter); 
        eqFilter.connect(limiter); 
        limiter.connect(masterGain);
        masterGain.connect(ctx.destination);

        masterEntryRef.current = hpFilter;
        masterGainRef.current = masterGain;

        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        
        return ctx;
    }, []);

    const toggleMute = () => {
        if (isMuted) {
            // Turning ON: Complete re-initialization of the engine
            if (timerIDRef.current) {
                clearTimeout(timerIDRef.current);
                timerIDRef.current = null;
            }
            
            const freshCtx = initAudio();
            if (freshCtx) {
                // Sync internal clock to new context timeline
                nextNoteTimeRef.current = freshCtx.currentTime + 0.1;
                // Start scheduler loop immediately
                scheduler();
                setIsMuted(false);
            }
        } else {
            // Turning OFF: Stop the engine and clean up to save resources
            if (timerIDRef.current) {
                clearTimeout(timerIDRef.current);
                timerIDRef.current = null;
            }
            if (audioCtxRef.current) {
                audioCtxRef.current.close().catch(() => {});
                audioCtxRef.current = null;
            }
            setIsMuted(true);
        }
    };

    useEffect(() => {
        const handleFirstInteraction = () => {
            if (!isMuted && !audioCtxRef.current) {
                const ctx = initAudio();
                if (ctx) {
                    nextNoteTimeRef.current = ctx.currentTime + 0.1;
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
            // Resync logic in case context was interrupted and then resumed by browser
            if (nextNoteTimeRef.current < audioCtxRef.current.currentTime) {
                nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.05;
            }
            if (!timerIDRef.current) scheduler();
        }
    }, [isGameOver, isMuted, scheduler]);

    // Handle background tab auto-suspension (Page Visibility API)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!audioCtxRef.current) return;
            
            if (document.visibilityState === 'hidden') {
                // Non-active tab: suspend audio to save resources and comply with browser behavior
                audioCtxRef.current.suspend().catch(() => {});
            } else if (document.visibilityState === 'visible' && !isMuted) {
                // Back to tab: resume if user hasn't manually muted
                audioCtxRef.current.resume().catch(() => {});
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isMuted]);

    return { 
        isMuted, 
        toggleMute, 
        bpm: Math.round(132 + ((1 - hp / 100) * 32)), 
        primaryMode: stablePrimaryModeRef.current 
    };
};