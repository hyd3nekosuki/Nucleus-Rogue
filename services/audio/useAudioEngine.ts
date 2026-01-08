import { useEffect, useRef, useState, useCallback } from 'react';
import { DecayMode } from '../../types';
import { playRhythm } from './audioSequencer';
import { createMasterRack } from './audioGraph';

// --- Internal Audio Configuration ---
const AUDIO_CONFIG = {
    BASE_BPM: 132,
    BPM_RANGE: 32,
    SCHEDULER_INTERVAL_MS: 25,
    LOOKAHEAD_SECONDS: 0.1, // How far ahead to schedule sounds (100ms)
    
    // Transition Speed Settings (Number of 16th steps for full fade)
    FADE_STEPS_FOUNDATION: 4,     // Very fast
    FADE_STEPS_ORNAMENTAL_IN: 8,  // Fast
    FADE_STEPS_ORNAMENTAL_OUT: 16 // Slow/Steady
};

/**
 * Pure utility to determine the most significant decay mode for the BGM pattern.
 */
const getPrimaryMode = (modes: DecayMode[]) => {
    return modes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) 
           || (modes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : DecayMode.STABLE);
};

export const useAudioEngine = (hp: number, isGameOver: boolean, decayModes: DecayMode[], isSoundTestActive: boolean = false, onKick?: () => void) => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);
    const masterEntryRef = useRef<AudioNode | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const nextNoteTimeRef = useRef(0);
    const currentStepRef = useRef(0);
    const timerIDRef = useRef<number | null>(null);

    // --- Transition Management ---
    const lastModeRef = useRef<DecayMode | null>(null);
    const transitionFromModeRef = useRef<DecayMode | null>(null);
    
    // Settling Logic (Debounce) to ignore intermediate states during rapid transformations
    const stablePrimaryModeRef = useRef<DecayMode>(getPrimaryMode(decayModes));
    const debounceTimerRef = useRef<number | null>(null);

    // Progress trackers for independent fade speeds
    const foundationProgressRef = useRef(1.0);
    const ornamentalInProgressRef = useRef(1.0);
    const ornamentalOutProgressRef = useRef(1.0);
    
    const F_STEP = 1.0 / AUDIO_CONFIG.FADE_STEPS_FOUNDATION;
    const O_IN_STEP = 1.0 / AUDIO_CONFIG.FADE_STEPS_ORNAMENTAL_IN;
    const O_OUT_STEP = 1.0 / AUDIO_CONFIG.FADE_STEPS_ORNAMENTAL_OUT;

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

    // --- UI Bridge ---
    const triggerKickUI = useCallback((time: number) => {
        if (onKick && audioCtxRef.current) {
            const delay = (time - audioCtxRef.current.currentTime) * 1000;
            // 通知は実際の音が発生するタイミングに合わせて遅延実行する
            setTimeout(onKick, Math.max(0, delay));
        }
    }, [onKick]);

    const scheduler = useCallback(() => {
        if (!audioCtxRef.current || !masterEntryRef.current) return;
        
        const hpFactor = 1.0 - (hpRef.current / 100);
        const currentBpm = AUDIO_CONFIG.BASE_BPM + (hpFactor * AUDIO_CONFIG.BPM_RANGE); 
        const secondsPerStep = 60 / currentBpm / 4;

        while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + AUDIO_CONFIG.LOOKAHEAD_SECONDS) {
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
                    const fOut = Math.sqrt(Math.max(0, 1.0 - foundationProgressRef.current));
                    const oOut = Math.sqrt(Math.max(0, 1.0 - ornamentalOutProgressRef.current));
                    playRhythm(transitionFromModeRef.current, ctx, dest, time, step, fOut, oOut, secondsPerStep, triggerKickUI);
                }
                const fIn = Math.sqrt(Math.min(1.0, foundationProgressRef.current));
                const oIn = Math.sqrt(Math.min(1.0, ornamentalInProgressRef.current));
                playRhythm(targetMode, ctx, dest, time, step, fIn, oIn, secondsPerStep, triggerKickUI);

                foundationProgressRef.current = Math.min(1.0, foundationProgressRef.current + F_STEP);
                ornamentalInProgressRef.current = Math.min(1.0, ornamentalInProgressRef.current + O_IN_STEP);
                ornamentalOutProgressRef.current = Math.min(1.0, ornamentalOutProgressRef.current + O_OUT_STEP);
            } else {
                playRhythm(targetMode, ctx, dest, time, step, 1.0, 1.0, secondsPerStep, triggerKickUI);
            }

            nextNoteTimeRef.current += secondsPerStep;
            currentStepRef.current = (currentStepRef.current + 1) % 16;
        }
        timerIDRef.current = window.setTimeout(scheduler, AUDIO_CONFIG.SCHEDULER_INTERVAL_MS);
    }, [triggerKickUI]);

    const initAudio = useCallback(() => {
        if (audioCtxRef.current) {
            try {
                audioCtxRef.current.close().catch(() => {});
            } catch(e) {}
            audioCtxRef.current = null;
        }

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;

        // Construct FX chain using external utility
        const rack = createMasterRack(ctx);
        masterEntryRef.current = rack.entry;
        masterGainRef.current = rack.masterGain;

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
        bpm: Math.round(AUDIO_CONFIG.BASE_BPM + ((1 - hp / 100) * AUDIO_CONFIG.BPM_RANGE)), 
        primaryMode: stablePrimaryModeRef.current 
    };
};