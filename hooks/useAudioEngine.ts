
import { DecayMode } from '../types';

/**
 * Audio Engine Stub
 * BGM functionality has been decommissioning.
 */
export const useAudioEngine = (hp: number, isGameOver: boolean, decayModes: DecayMode[]) => {
    // Return empty handlers and default values
    const toggleMute = () => {};
    
    return { 
        isMuted: true, 
        toggleMute, 
        bpm: 0, 
        primaryMode: "" 
    };
};
