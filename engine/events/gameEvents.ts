
type GameEffectType = 'SHAKE' | 'FLASH' | 'TTS';

export interface GameEffectEvent {
    type: GameEffectType;
    payload?: any;
}

type Listener = (event: GameEffectEvent) => void;

/**
 * Singleton Event Bus for game effects.
 * Allows physics logic to signal UI changes (shake, flash, TTS) without direct dependencies.
 */
class GameEventBus {
    private listeners: Set<Listener> = new Set();

    /**
     * Subscribes a listener to the event bus.
     * @returns Unsubscribe function.
     */
    subscribe(listener: Listener) {
        this.listeners.add(listener);
        // Fix: Explicitly return void in the unsubscribe function to satisfy React's useEffect Destructor type
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Emits a UI effect event.
     */
    emitEffect(type: GameEffectType, payload?: any) {
        const event: GameEffectEvent = { type, payload };
        this.listeners.forEach(listener => listener(event));
    }
}

export const gameEventBus = new GameEventBus();

/**
 * Convenience wrappers for physics engine to trigger global effects.
 */
export const emitShake = (duration?: number) => gameEventBus.emitEffect('SHAKE', duration);
export const emitFlash = (color: string, duration?: number) => gameEventBus.emitEffect('FLASH', { color, duration });
export const emitTTS = (text: string) => gameEventBus.emitEffect('TTS', text);