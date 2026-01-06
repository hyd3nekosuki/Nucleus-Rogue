import { EntityType, HistoryEntry } from '../types';
import { HISTORY_METHODS } from '../constants';

/**
 * Pure function to determine the scientific method name for the evolution history.
 */
export const getHistoryMethod = (
    isPpFusion: boolean,
    isPositronAbsorption: boolean,
    targetEntity: { type: EntityType } | undefined,
    inducedReactionLabel?: string
): string => {
    if (inducedReactionLabel) return inducedReactionLabel;
    if (isPpFusion) return HISTORY_METHODS.FUSION;
    if (isPositronAbsorption) return HISTORY_METHODS.POSITRON_CAPTURE;
    
    if (targetEntity) {
        if (targetEntity.type === EntityType.PROTON) return HISTORY_METHODS.PROTON_CAPTURE;
        if (targetEntity.type === EntityType.NEUTRON) return HISTORY_METHODS.NEUTRON_CAPTURE;
        if (targetEntity.type === EntityType.ENEMY_ELECTRON) return HISTORY_METHODS.ELECTRON_CAPTURE_PLAYER;
    }
    
    return HISTORY_METHODS.TRANSMUTATION;
};