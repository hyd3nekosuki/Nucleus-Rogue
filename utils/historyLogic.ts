
import { EntityType } from '../types';
import { HISTORY_METHODS } from '../constants';

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
    // 1. Explicitly induced reactions (High energy neutron events) take precedence
    if (inducedReactionLabel) return inducedReactionLabel;
    
    // 2. Specialized Fusion and Positron capture mechanics
    if (isPpFusion) return HISTORY_METHODS.FUSION;
    if (isPositronAbsorption) return HISTORY_METHODS.POSITRON_CAPTURE;
    
    // 3. Entity absorption through direct collision
    if (targetEntity) {
        switch (targetEntity.type) {
            case EntityType.PROTON: return HISTORY_METHODS.PROTON_CAPTURE;
            case EntityType.NEUTRON: return HISTORY_METHODS.NEUTRON_CAPTURE;
            case EntityType.ENEMY_ELECTRON: return HISTORY_METHODS.ELECTRON_CAPTURE_PLAYER;
            default: break;
        }
    }
    
    // 4. Default fallback (General Transmutation)
    return HISTORY_METHODS.TRANSMUTATION;
};
