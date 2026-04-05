
import { useEffect } from 'react';
import { gameEventBus, GameEffectEvent } from '../engine/events/gameEvents';

interface EffectCallbacks {
    onShake: (duration?: number) => void;
    onFlash: (color: string, duration?: number) => void;
    onTTS: (text: string) => void;
}

/**
 * Hook to listen for engine-triggered visual and audio effects.
 * Bridges the pure logic engine to React-based UI effects.
 */
export const useGameEventListener = (callbacks: EffectCallbacks) => {
    useEffect(() => {
        const handler = (event: GameEffectEvent) => {
            switch (event.type) {
                case 'SHAKE':
                    callbacks.onShake(event.payload);
                    break;
                case 'FLASH':
                    if (event.payload) {
                        callbacks.onFlash(event.payload.color, event.payload.duration);
                    }
                    break;
                case 'TTS':
                    if (typeof event.payload === 'string') {
                        callbacks.onTTS(event.payload);
                    } else if (event.payload?.text) {
                        callbacks.onTTS(event.payload.text);
                    }
                    break;
            }
        };

        // Subscribe to the event bus singleton
        const unsubscribe = gameEventBus.subscribe(handler);
        
        // Ensure cleanup on component unmount to prevent memory leaks
        return unsubscribe;
    }, [callbacks.onShake, callbacks.onFlash, callbacks.onTTS]);
};
