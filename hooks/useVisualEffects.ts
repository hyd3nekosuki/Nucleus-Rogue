import { useState, useCallback, useEffect, useRef } from 'react';
import { DecayMode, GameState } from '../types';
import { emitShake, emitFlash, emitTTS } from '../engine/events/gameEvents';

/**
 * Custom hook to manage transient visual effect states and bridge engine events.
 * Bridges the pure logic engine state to React-based UI effects.
 */
export const useVisualEffects = (gameState?: GameState) => {
    const [isScreenShaking, setIsScreenShaking] = useState(false);
    const [isFlashBang, setIsFlashBang] = useState(false);
    const [flashColor, setFlashColor] = useState('bg-neon-blue');
    const [lastDecayEvent, setLastDecayEvent] = useState<{ mode: DecayMode; timestamp: number } | null>(null);
    const [finalCombo, setFinalCombo] = useState<{ count: number; id: number } | null>(null);

    const lastProcessedEventId = useRef<number>(0);

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
     * This keeps the Reducer pure while allowing it to drive animations and audio.
     */
    useEffect(() => {
        if (!gameState?.lastEvent) return;

        const event = gameState.lastEvent;
        if (event.id <= lastProcessedEventId.current) return;
        lastProcessedEventId.current = event.id;

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

        // 3. Audio/Voice Feedback (TTS)
        if (event.message) {
            emitTTS(event.message);
        }

        // 4. Special Case: Internal Decay Sync for Visualizer
        if (event.type === 'DECAY' && event.subType) {
            setLastDecayEvent({
                mode: event.subType as DecayMode,
                timestamp: event.id
            });
        }

        // 5. Reincarnation specific TTS (Previously handled in coordinator)
        if (event.type === 'SURVIVAL' && event.subType === 'REINCARNATION') {
            emitTTS("Reincarnation");
        }

    }, [gameState?.lastEvent, triggerShake, triggerFlash]);

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
