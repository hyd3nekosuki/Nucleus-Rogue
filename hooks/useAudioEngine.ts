import { useEffect, useRef, useState } from 'react';
import { DecayMode } from '../types';

export const useAudioEngine = (hp: number, isGameOver: boolean, decayModes: DecayMode[]) => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const nextNoteTimeRef = useRef(0);
    const currentStepRef = useRef(0);
    const timerIDRef = useRef<number | null>(null);

    // Get primary decay mode for musical influence
    const primaryMode = decayModes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) 
                       || (decayModes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : DecayMode.STABLE);

    const bpm = 122 + (1 - hp / 100) * 33;
    const secondsPerStep = 60 / bpm / 4;

    // --- Sound Synthesis Functions ---

    const createKick = (ctx: AudioContext, time: number, isAlpha: boolean) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        // Alpha decay makes the kick heavier/deeper
        const startFreq = isAlpha ? 180 : 120;
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + (isAlpha ? 0.3 : 0.15));
        
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + (isAlpha ? 0.3 : 0.15));

        osc.start(time);
        osc.stop(time + 0.3);
    };

    const createHiHat = (ctx: AudioContext, time: number, volume: number, isBetaMinus: boolean) => {
        const bufferSize = ctx.sampleRate * 0.02;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        // Beta- makes hats brighter and "electric"
        filter.frequency.setValueAtTime(isBetaMinus ? 8000 : 10000, time);

        const gain = ctx.createGain();
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(isBetaMinus ? volume * 1.5 : volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

        noise.start(time);
        noise.stop(time + 0.05);
    };

    const createDecayFx = (ctx: AudioContext, time: number, mode: DecayMode) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        if (mode === DecayMode.BETA_PLUS || mode === DecayMode.ELECTRON_CAPTURE) {
            // Positron/EC: "Vacuum" whoosh
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, time);
            osc.frequency.exponentialRampToValueAtTime(2000, time + 0.2);
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1000, time);
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.1, time + 0.1);
            gain.gain.linearRampToValueAtTime(0, time + 0.2);
        } else if (mode === DecayMode.SPONTANEOUS_FISSION) {
            // Fission: Harsh glitch
            osc.type = 'square';
            osc.frequency.setValueAtTime(Math.random() * 100 + 50, time);
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2000, time);
            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        } else if (mode === DecayMode.UNKNOWN) {
            // Unknown: Dissonant metallic ring
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, time);
            osc.frequency.linearRampToValueAtTime(890, time + 0.4); // Detuning
            gain.gain.setValueAtTime(0.03, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
        }

        osc.start(time);
        osc.stop(time + 0.5);
    };

    const scheduler = () => {
        if (!audioCtxRef.current) return;
        while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.1) {
            const time = nextNoteTimeRef.current;
            const step = currentStepRef.current;

            // --- Pattern Influenced by Decay Mode ---
            const isStable = primaryMode === DecayMode.STABLE;
            const isAlpha = primaryMode === DecayMode.ALPHA;
            const isBetaMinus = primaryMode === DecayMode.BETA_MINUS;
            const isFission = primaryMode === DecayMode.SPONTANEOUS_FISSION;

            // 1. Kick Logic
            if (step % 4 === 0) {
                createKick(audioCtxRef.current, time, isAlpha);
            }
            // Double kick for Alpha
            if (isAlpha && step % 4 === 1 && Math.random() > 0.5) {
                createKick(audioCtxRef.current, time, true);
            }

            // 2. Hat Logic (Beta- increases density)
            const hatProb = isBetaMinus ? 0.8 : 0.4;
            if (step % 2 === 0 || Math.random() < hatProb) {
                createHiHat(audioCtxRef.current, time, 0.05, isBetaMinus);
            }

            // 3. Fx/Glitch Logic
            if (!isStable) {
                if (isFission && Math.random() > 0.7) {
                    createDecayFx(audioCtxRef.current, time, DecayMode.SPONTANEOUS_FISSION);
                } else if (step % 8 === 6) {
                    createDecayFx(audioCtxRef.current, time, primaryMode);
                }
            }

            // 4. Bass Line
            if (step % 4 !== 0) {
                const osc = audioCtxRef.current.createOscillator();
                const gain = audioCtxRef.current.createGain();
                const filter = audioCtxRef.current.createBiquadFilter();

                osc.type = 'sawtooth';
                // Unknown mode detunes the bass
                const detune = primaryMode === DecayMode.UNKNOWN ? Math.random() * 10 - 5 : 0;
                osc.frequency.setValueAtTime(55 + detune, time); // A1
                
                const filterFreq = 100 + (1 - hp/100) * 1000 + (isFission ? 500 : 0);
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(filterFreq, time);
                filter.Q.setValueAtTime(isFission ? 15 : 5, time);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(audioCtxRef.current.destination);

                gain.gain.setValueAtTime(0.08, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + secondsPerStep * 0.8);

                osc.start(time);
                osc.stop(time + secondsPerStep * 0.8);
            }

            nextNoteTimeRef.current += secondsPerStep;
            currentStepRef.current = (currentStepRef.current + 1) % 16;
        }
        timerIDRef.current = window.setTimeout(scheduler, 25);
    };

    const toggleMute = () => {
        if (isMuted) {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }
            nextNoteTimeRef.current = audioCtxRef.current.currentTime;
            scheduler();
            setIsMuted(false);
        } else {
            if (timerIDRef.current) clearTimeout(timerIDRef.current);
            setIsMuted(true);
        }
    };

    useEffect(() => {
        if (isGameOver && !isMuted) {
            if (timerIDRef.current) clearTimeout(timerIDRef.current);
            setIsMuted(true);
        }
    }, [isGameOver, isMuted]);

    return { isMuted, toggleMute, bpm: Math.round(bpm), primaryMode };
};