import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DecayMode, GameState, GameAction } from '../types';
import { emitShake, emitFlash, emitTTS } from '../engine/events/gameEvents';

// Define the priority order for vocalization (Lower index = Higher priority)
const SPEECH_PRIORITY = [
    "Nuclear Fusion",
    "Nuclear Fission",
    "Pair Annihilation",
    "Rapid Process Nucleosynthesis",
    "Nucleosynthesis",
    "Experimental Replication",
    "Mastery Level",
    "Reincarnation",
    "Temporal Inversion",
    "Total Annihilation"
];

/**
 * Custom hook to manage transient visual effect states and bridge engine events.
 */
export const useVisualEffects = (gameState?: GameState, dispatch?: React.Dispatch<GameAction>) => {
    const [isScreenShaking, setIsScreenShaking] = useState(false);
    const [isFlashBang, setIsFlashBang] = useState(false);
    const [flashColor, setFlashColor] = useState('bg-neon-blue');
    const [lastDecayEvent, setLastDecayEvent] = useState<{ mode: DecayMode; timestamp: number; isPlayed?: boolean } | null>(null);
    const [finalCombo, setFinalCombo] = useState<{ count: number; id: number } | null>(null);

    const lastProcessedEventId = useRef<number>(gameState?.lastEvent?.id || 0);

    // CRITICAL: On mount, mark any existing event or effects as "played" 
    // to prevent ghosting when switching tabs in AI Studio.
    useEffect(() => {
        if (!dispatch) return;
        
        if (gameState?.lastEvent && !gameState.lastEvent.isPlayed) {
            dispatch({ type: 'MARK_EVENT_PLAYED', payload: { eventId: gameState.lastEvent.id } });
        }
        
        const unplayedEffectIds = gameState?.effects
            ?.filter(e => !e.isPlayed)
            ?.map(e => e.id) || [];
            
        if (unplayedEffectIds.length > 0) {
            dispatch({ type: 'MARK_EFFECTS_PLAYED', payload: { effectIds: unplayedEffectIds } });
        }
    }, []); // Run once on mount

    const triggerShake = useCallback((duration: number = 300) => {
        setIsScreenShaking(true);
        setTimeout(() => setIsScreenShaking(false), duration);
    }, []);

    const triggerFlash = useCallback((color: string, duration: number = 500) => {
        setFlashColor(color);
        setIsFlashBang(true);
        setTimeout(() => setIsFlashBang(false), duration);
    }, []);

    const resetVisuals = useCallback(() => {
        setLastDecayEvent(null);
        setFinalCombo(null);
        lastProcessedEventId.current = 0;
    }, []);

    /**
     * Effect Bridge: Monitors gameState.lastEvent to trigger global UI side-effects.
     */
    useEffect(() => {
        if (!gameState?.lastEvent) return;

        const event = gameState.lastEvent;
        
        // CRITICAL: Skip if event is already marked as played in the state
        if (event.isPlayed) return;
        
        if (event.id <= lastProcessedEventId.current) return;
        lastProcessedEventId.current = event.id;

        // Skip all logic for time stop/restore events to fix animation replay side-effects and TTS suppression
        if (event.subType === 'TIME_STOP') {
            // Still mark it as played so we don't keep checking it
            if (dispatch) dispatch({ type: 'MARK_EVENT_PLAYED', payload: { eventId: event.id } });
            return;
        }

        // 1. Physical Feedback (Shake)
        if (event.shake) {
            triggerShake();
            emitShake();
        }

        // 2. Visual Feedback (Flash)
        if (event.flash) {
            triggerFlash(event.flash);
            emitFlash(event.flash);
        }

        // 3. Audio/Voice Feedback (Priority Selection)
        // We evaluate all candidate messages to find the most "Important" one to announce.
        const candidates = [...(event.priorityMessages || [])];
        if (event.message && event.subType !== 'COMBO_SETTLED') candidates.push(event.message);

        if (candidates.length > 0) {
            // Sort by defined priority (Nuclear Fusion > Fission > etc.)
            const sortedCandidates = candidates.sort((a, b) => {
                const scoreA = SPEECH_PRIORITY.findIndex(p => a.startsWith(p));
                const scoreB = SPEECH_PRIORITY.findIndex(p => b.startsWith(p));
                const pA = scoreA === -1 ? 999 : scoreA;
                const pB = scoreB === -1 ? 999 : scoreB;
                return pA - pB;
            });
            
            // Pick exactly one "winner" (the highest priority event)
            const winner = sortedCandidates[0];
            
            // Trigger the TTS system with the winning event. 
            // useTTS will then handle the "Event + Nuclide Name" sequence.
            emitTTS(winner);
        }

        // 4. Special Case: Internal Decay Sync for Visualizer
        // Modified: Preserved trigger field takes priority to allow simultaneous combo and decay visuals
        const decayToVisualise = event.decayModeTrigger || (event.type === 'DECAY' ? event.subType : null);
        if (decayToVisualise) {
            setLastDecayEvent({
                mode: decayToVisualise as DecayMode,
                timestamp: event.id,
                isPlayed: event.isPlayed
            });
        }

        // 5. Special Case: Combo Settlement for Grid Display
        if (event.subType === 'COMBO_SETTLED' && event.message) {
            const count = parseInt(event.message);
            if (!isNaN(count) && count >= 2) {
                setFinalCombo({ count, id: event.id });
            }
        }

        // 6. Reincarnation specific (Ensuring it's caught if not in priorityMessages)
        if (event.type === 'SURVIVAL' && event.subType === 'REINCARNATION' && !event.priorityMessages?.includes("Reincarnation")) {
            emitTTS("Reincarnation");
        }

        // 7. Mark event as played in the global state
        if (dispatch) {
            dispatch({ type: 'MARK_EVENT_PLAYED', payload: { eventId: event.id } });
        }

    }, [gameState?.lastEvent, triggerShake, triggerFlash, dispatch]);

    /**
     * Effect Bridge: Monitors gameState.effects to mark them as played.
     * This ensures that on tab-switch, we don't re-process effects that were already handled.
     */
    useEffect(() => {
        if (!gameState?.effects || gameState.effects.length === 0 || !dispatch) return;

        const unplayedIds = gameState.effects
            .filter(e => !e.isPlayed)
            .map(e => e.id);

        if (unplayedIds.length > 0) {
            dispatch({ type: 'MARK_EFFECTS_PLAYED', payload: { effectIds: unplayedIds } });
        }
    }, [gameState?.effects, dispatch]);

    return {
        isScreenShaking,
        isFlashBang,
        flashColor,
        lastDecayEvent,
        finalCombo,
        triggerShake,
        triggerFlash,
        setLastDecayEvent,
        setFinalCombo,
        resetVisuals
    };
};