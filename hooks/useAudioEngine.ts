
import { useEffect, useRef, useState, useCallback } from 'react';
import { DecayMode } from '../types';

export const useAudioEngine = (hp: number, isGameOver: boolean, decayModes: DecayMode[], isSoundTestActive: boolean = false, onKick?: () => void, activeEvent?: { type: string; color: string; timestamp: number }) => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);
    const masterEntryRef = useRef<BiquadFilterNode | null>(null);
    const distortionNodeRef = useRef<WaveShaperNode | null>(null);
    const distortionGainRef = useRef<GainNode | null>(null); // Dry/Wet mix controller
    
    const [isMuted, setIsMuted] = useState(true);
    const nextNoteTimeRef = useRef(0);
    const currentStepRef = useRef(0);
    const timerIDRef = useRef<number | null>(null);

    // Event timing tracking
    const lastEventTimestampRef = useRef<number>(0);
    const eventRemainingStepsRef = useRef<number>(0);
    const activeEventTypeRef = useRef<string | null>(null);

    const getPrimaryMode = (modes: DecayMode[]) => {
        return modes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) 
               || (modes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : DecayMode.STABLE);
    };

    // Distortion Curve Factory
    const makeDistortionCurve = (amount: number, type: string | null) => {
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = i * 2 / n_samples - 1;
            if (type === 'INVERSION') {
                // Bit-crush feel: Steppy curve
                curve[i] = Math.round(x * amount) / amount;
            } else if (type === 'NEUTRON_STORM') {
                // Heavy saturated bass saturation
                curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
            } else if (type === 'PROTON_BURST') {
                // Hard clip
                curve[i] = Math.max(-0.5, Math.min(0.5, x * amount));
            } else {
                // Default Soft-clip
                curve[i] = (3 + amount) * x * deg / (Math.PI + amount * Math.abs(x));
            }
        }
        return curve;
    };

    // Sync Event Status
    useEffect(() => {
        if (activeEvent && activeEvent.timestamp !== lastEventTimestampRef.current) {
            lastEventTimestampRef.current = activeEvent.timestamp;
            eventRemainingStepsRef.current = 32; // 2 bars (16 steps * 2)
            activeEventTypeRef.current = activeEvent.type;
            
            // Re-generate curve based on type
            if (distortionNodeRef.current) {
                distortionNodeRef.current.curve = makeDistortionCurve(50, activeEvent.type);
            }
        }
    }, [activeEvent]);

    // --- Transition Management ---
    const lastModeRef = useRef<DecayMode | null>(null);
    const transitionFromModeRef = useRef<DecayMode | null>(null);
    const stablePrimaryModeRef = useRef<DecayMode>(getPrimaryMode(decayModes));
    const debounceTimerRef = useRef<number | null>(null);

    const foundationProgressRef = useRef(1.0);
    const ornamentalInProgressRef = useRef(1.0);
    const ornamentalOutProgressRef = useRef(1.0);
    
    const F_STEP = 1.0 / 4;
    const O_IN_STEP = 1.0 / 8;
    const O_OUT_STEP = 1.0 / 16;

    const hpRef = useRef(hp);
    const decayModesRef = useRef(decayModes);

    useEffect(() => {
        hpRef.current = hp;
    }, [hp]);

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

    const triggerKickUI = (time: number) => {
        if (onKick && audioCtxRef.current) {
            const delay = (time - audioCtxRef.current.currentTime) * 1000;
            setTimeout(onKick, Math.max(0, delay));
        }
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
        } else if (type === 'acid') {
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(freq * 4, time);
            filter.frequency.exponentialRampToValueAtTime(freq * 1.5, time + duration);
            filter.Q.setValueAtTime(12, time);
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
                if (step % 4 === 0) { createKick(ctx, dest, time, 0.8 * fP); triggerKickUI(time); }
                if (step % 4 === 2) createHat(ctx, dest, time, oP, 0.8);
                if (step % 8 === 6) createHat(ctx, dest, time, oP * 1.1, 1.1);
                if (step % 16 === 14) createSynth(ctx, dest, time, 2637, 0.08, 0.2 * so, 'pulse');
                break;
            case DecayMode.BETA_MINUS:
                if (step % 4 === 0) { createKick(ctx, dest, time, 0.85 * fP, 'dnb-punch'); triggerKickUI(time); }
                if (step === 12) createSnare(ctx, dest, time, 0.7 * oP, 'industrial');
                if (step % 4 === 2) createHat(ctx, dest, time, oP * 1.2, 1.3);
                if ([3, 7, 11, 15].includes(step)) {
                    createSynth(ctx, dest, time, 110, 0.04, 0.6 * so, 'dark');
                }
                if (step % 2 === 0) {
                    createSynth(ctx, dest, time, 55, 0.05, 0.4 * sf, 'pulse');
                }
                break;
            case DecayMode.BETA_PLUS:
                if ([0, 3, 6, 9, 13].includes(step)) { createKick(ctx, dest, time, 0.9 * fP); triggerKickUI(time); }
                if (step === 4 || step === 12) createSnare(ctx, dest, time, 0.6 * oP, 'sharp');
                if (step % 2 === 1) createHat(ctx, dest, time, oP, 1.1);
                if (step % 16 === 7) createSynth(ctx, dest, time, 880, 0.2, 0.6 * so, 'sparkle');
                break;
            case DecayMode.ELECTRON_CAPTURE:
                if ([1, 4, 7, 10, 14].includes(step)) { createKick(ctx, dest, time, 0.85 * fP, 'dnb-punch'); triggerKickUI(time); }
                if (step % 4 === 2 || step === 5 || step === 13) {
                    createSynth(ctx, dest, time, 41.2, 0.12, 0.55 * sf, 'pulse');
                }
                const raveSequence = [220, 0, 165, 330, 0, 440, 0, 220, 110, 0, 165, 0, 220, 0, 330, 440];
                if (raveSequence[step] > 0) {
                    createSynth(ctx, dest, time, raveSequence[step], 0.06, 0.45 * so, 'acid');
                }
                if (step === 2 || step === 11) createSnare(ctx, dest, time, 0.7 * oP, 'industrial');
                createHat(ctx, dest, time, oP * (step % 2 === 0 ? 0.6 : 1.1), 1.2);
                break;
            case DecayMode.ALPHA:
                if (step === 0 || step === 10) { createKick(ctx, dest, time, 0.95 * fP, 'dnb-punch'); triggerKickUI(time); }
                createSynth(ctx, dest, time, step % 8 < 4 ? 41.2 : 38.8, secondsPerStep * 2.5, 0.9 * sf, 'dark');
                if (step === 4 || step === 12) createSnare(ctx, dest, time, 1.0 * oP, 'dnb-crack');
                createHat(ctx, dest, time, oP * (step % 2 === 0 ? 0.9 : 0.5), 1.1);
                if (step % 4 === 1) createSynth(ctx, dest, time, 1760, 0.05, 0.3 * so, 'dnb-lead');
                break;
            case DecayMode.SPONTANEOUS_FISSION:
                if (step % 4 === 0) { createKick(ctx, dest, time, 1.0 * fP, 'dnb-punch'); triggerKickUI(time); }
                if (step === 4 || step === 12) createSnare(ctx, dest, time, 1.1 * oP, 'industrial');
                if (step === 15) createSnare(ctx, dest, time, 0.4 * oP, 'sharp');
                if (step % 2 === 0) createHat(ctx, dest, time, oP * 0.6, 0.9);
                if (step % 4 === 2) {
                    createSynth(ctx, dest, time, 2637, 0.05, 0.9 * so, 'pulse');
                    createSynth(ctx, dest, time, 3520, 0.03, 0.5 * so, 'sparkle');
                }
                const coolBass = [92.5, 92.5, 110, 110, 123.47, 123.47, 110, 82.41, 92.5, 92.5, 110, 110, 123.47, 123.47, 138.59, 164.81];
                createSynth(ctx, dest, time, coolBass[step], secondsPerStep * 0.7, 0.8 * sf, 'dark');
                break;
            case DecayMode.NEUTRON_EMISSION:
                if (step % 4 === 0) { createKick(ctx, dest, time, 1.15 * fP, 'heavy-gabber'); triggerKickUI(time); }
                if (step % 4 !== 0) createSynth(ctx, dest, time, 41.2, secondsPerStep * 2, 0.7 * sf, 'dark');
                if (step % 8 === 2 || step % 8 === 6) createSnare(ctx, dest, time, oP * 0.9, 'industrial');
                if (Math.random() > 0.6) createHat(ctx, dest, time, oP, 1.7);
                break;
            case DecayMode.PROTON_EMISSION:
                if (step % 4 === 0) { createKick(ctx, dest, time, 0.95 * fP, 'dnb-punch'); triggerKickUI(time); }
                if (step % 4 === 2) createHat(ctx, dest, time, oP * 1.4, 1.3);
                if (step % 2 === 1) createHat(ctx, dest, time, oP * 0.7, 0.9);
                if ([0, 3, 6, 10, 13].includes(step)) createSynth(ctx, dest, time, [1760, 2637, 3520][step % 3], 0.1, 0.4 * so, 'sparkle');
                if (step === 15) for(let i = 0; i < 4; i++) createSynth(ctx, dest, time + (i * 0.025), 3520 + (i * 440), 0.03, 0.16 * so, 'pulse');
                break;
            case DecayMode.UNKNOWN:
                if (step === 0) createSynth(ctx, dest, time, 32.7, secondsPerStep * 24, 0.4 * sf, 'void');
                if (step === 8) createSynth(ctx, dest, time, 38.8, secondsPerStep * 16, 0.3 * sf, 'void');
                const crystalFrequencies = [
                    1396.91, 1396.91, 1396.91, 1396.91, 
                    1244.51, 1108.73, 1046.50, 932.33,  
                    830.61, 783.99, 698.46, 783.99,     
                    830.61, 932.33, 1046.50, 1108.73    
                ];
                createSynth(ctx, dest, time, crystalFrequencies[step], 0.25, 0.5 * so, 'sparkle');
                if (step % 4 === 2) {
                    createSynth(ctx, dest, time, crystalFrequencies[step] * 2, 0.05, 0.2 * so, 'pulse');
                }
                if (step % 8 === 0) { createKick(ctx, dest, time, 0.4 * fP, 'sharp-gabber'); triggerKickUI(time); }
                break;
            default:
                if (step % 4 === 0) { createKick(ctx, dest, time, 0.7 * fP); triggerKickUI(time); }
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

            // Handle Event Distortion Logic
            if (eventRemainingStepsRef.current > 0) {
                if (distortionGainRef.current) {
                    // Quick fade in for distortion mix
                    distortionGainRef.current.gain.setTargetAtTime(0.85, time, 0.01);
                    
                    // Specific "noise" artifacts per type
                    if (activeEventTypeRef.current === 'ELECTRON_FLUCTUATION' && Math.random() > 0.8) {
                        distortionGainRef.current.gain.setTargetAtTime(0, time, 0.005); // Gate effect
                    }
                }
                eventRemainingStepsRef.current--;
            } else {
                if (distortionGainRef.current) {
                    distortionGainRef.current.gain.setTargetAtTime(0, time, 0.05); // Smooth cleanup
                }
            }

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
                    const fOut = Math.sqrt(Math.max(0, 1.0 - foundationProgressRef.current));
                    const oOut = Math.sqrt(Math.max(0, 1.0 - ornamentalOutProgressRef.current));
                    playRhythm(transitionFromModeRef.current, ctx, dest, time, step, fOut, oOut, secondsPerStep);
                }
                const fIn = Math.sqrt(Math.min(1.0, foundationProgressRef.current));
                const oIn = Math.sqrt(Math.min(1.0, ornamentalInProgressRef.current));
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
    }, [onKick]);

    const initAudio = useCallback(() => {
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

        // Distortion Nodes
        const distNode = ctx.createWaveShaper();
        distNode.curve = makeDistortionCurve(50, null);
        distNode.oversample = '4x';
        distortionNodeRef.current = distNode;

        const distGain = ctx.createGain();
        distGain.gain.setValueAtTime(0, ctx.currentTime);
        distortionGainRef.current = distGain;

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

        // Distortion chain in parallel-ish to preserve dynamics
        limiter.connect(distNode);
        distNode.connect(distGain);
        distGain.connect(masterGain);
        
        // Dry signal
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
            if (timerIDRef.current) {
                clearTimeout(timerIDRef.current);
                timerIDRef.current = null;
            }
            
            const freshCtx = initAudio();
            if (freshCtx) {
                nextNoteTimeRef.current = freshCtx.currentTime + 0.1;
                scheduler();
                setIsMuted(false);
            }
        } else {
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
                    if (!timerIDRef.current && (!isGameOver || isSoundTestActive)) scheduler();
                }
            }
        };
        window.addEventListener('click', handleFirstInteraction, { once: true });
        window.addEventListener('keydown', handleFirstInteraction, { once: true });
        return () => {
            window.removeEventListener('click', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
        };
    }, [isMuted, isGameOver, isSoundTestActive, initAudio, scheduler]);

    useEffect(() => {
        if (isGameOver && !isSoundTestActive) {
            if (timerIDRef.current) {
                clearTimeout(timerIDRef.current);
                timerIDRef.current = null;
            }
        } else if (!isMuted && audioCtxRef.current) {
            if (nextNoteTimeRef.current < audioCtxRef.current.currentTime) {
                nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.05;
            }
            if (!timerIDRef.current) scheduler();
        }
    }, [isGameOver, isMuted, isSoundTestActive, scheduler]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!audioCtxRef.current) return;
            
            if (document.visibilityState === 'hidden') {
                audioCtxRef.current.suspend().catch(() => {});
            } else if (document.visibilityState === 'visible' && !isMuted) {
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
