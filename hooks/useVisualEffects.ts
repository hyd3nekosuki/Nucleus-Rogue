import { useState, useCallback } from 'react';
import { DecayMode } from '../types';

/**
 * Custom hook to manage transient visual effect states.
 * Isolates visual orchestration from the core game rules.
 */
export const useVisualEffects = () => {
    const [isScreenShaking, setIsScreenShaking] = useState(false);
    const [isFlashBang, setIsFlashBang] = useState(false);
    const [flashColor, setFlashColor] = useState('bg-neon-blue');
    const [lastDecayEvent, setLastDecayEvent] = useState<{ mode: DecayMode; timestamp: number } | null>(null);
    const [finalCombo, setFinalCombo] = useState<{ count: number; id: number } | null>(null);

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
    }, []);

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