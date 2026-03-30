
import { EntityType } from '../types';
import { LOG_MESSAGES } from '../constants';

/**
 * Determines the scientific method name for the evolution history.
 * Pure logic function converting game interaction state to historical terminology.
 * 
 * @param isPpFusion Whether a proton-proton fusion occurred
 * @param isPositronAbsorption Whether a positron was captured (β+ inversion)
 * @param targetEntity The entity the player collided with, if any
 * @param inducedReactionLabel Specific reaction label (e.g. "(n,γ)") if triggered
 */
export const getHistoryMethod = (
    isPpFusion: boolean,
    isPositronAbsorption: boolean,
    targetEntity: { type: EntityType } | undefined | null,
    inducedReactionLabel?: string | null
): string => {
    const historyMethods = LOG_MESSAGES.HISTORY;

    // 1. Explicitly induced reactions (High energy neutron events) take precedence
    if (inducedReactionLabel) return inducedReactionLabel;
    
    // 2. Specialized Fusion and Positron capture mechanics
    if (isPpFusion) return historyMethods.FUSION;
    if (isPositronAbsorption) return historyMethods.POSITRON_CAPTURE;
    
    // 3. Entity absorption through direct collision
    if (targetEntity) {
        switch (targetEntity.type) {
            case EntityType.PROTON: return historyMethods.PROTON_CAPTURE;
            case EntityType.NEUTRON: return historyMethods.NEUTRON_CAPTURE;
            case EntityType.ENEMY_ELECTRON: return historyMethods.ELECTRON_CAPTURE_PLAYER;
            default: break;
        }
    }
    
    // 4. Default fallback (General Transmutation)
    return historyMethods.TRANSMUTATION;
};

/**
 * Localizes a scientific reaction label for display in the game log.
 * Maps the authoritative English label back to its localized equivalent.
 * 
 * @param englishLabel The English reaction label (e.g. "Neutron capture")
 * @param logMessages The localized log messages object
 */
export const getLocalizedReactionLabel = (englishLabel: string, logMessages: any): string => {
    if (!englishLabel) return "";
    
    // Find the key in the English HISTORY constants that matches the provided label
    const key = Object.keys(LOG_MESSAGES.HISTORY).find(
        k => (LOG_MESSAGES.HISTORY as any)[k] === englishLabel
    );
    
    // If found, return the localized version from the current logMessages
    if (key && logMessages.HISTORY && logMessages.HISTORY[key]) {
        return logMessages.HISTORY[key];
    }
    
    return englishLabel;
};
