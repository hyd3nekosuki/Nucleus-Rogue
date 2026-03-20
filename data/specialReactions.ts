import { SpecialReaction } from '../types';
import { ALPHA_INDUCED_REACTIONS } from './alphaInducedReactions';
import { SPECIAL_REACTIONS as HISTORICAL } from './historicalAndNeutronReactions';
import { LIGHT_ION_REACTIONS } from './lightIonReactions';
import { HEAVY_ION_FUSION_REACTIONS } from './heavyIonFusionReactions';

/**
 * UNIFIED REACTION REGISTRY (BARREL)
 * Single Source of Truth for all specialized nuclear reactions.
 * Categorized by physical projectile type for maintainability.
 */

export const SPECIAL_REACTIONS: SpecialReaction[] = [
    ...HISTORICAL,
    ...LIGHT_ION_REACTIONS,
    ...ALPHA_INDUCED_REACTIONS,
    ...HEAVY_ION_FUSION_REACTIONS
];

/**
 * Global lookup function for special reactions.
 * Searches the integrated database for matching (z, a) pairs.
 * Correctly handles symmetry (A+B is same as B+A).
 */
export const findSpecialReaction = (z1: number, a1: number, z2: number, a2: number): SpecialReaction | null => {
    return SPECIAL_REACTIONS.find(r => 
        (r.z1 === z1 && r.a1 === a1 && r.z2 === z2 && r.a2 === a2) ||
        (r.z1 === z2 && r.a1 === a2 && r.z2 === z1 && r.a2 === a1)
    ) || null;
};

/**
 * Finds all potential reaction partners for a specific nuclide (z, a).
 * Used by the spawning engine to determine which mid-bosses should appear.
 */
export const findReactionPartners = (z: number, a: number): { z: number, a: number }[] => {
    const partners: { z: number, a: number }[] = [];
    SPECIAL_REACTIONS.forEach(r => {
        if (r.z1 === z && r.a1 === a) partners.push({ z: r.z2, a: r.a2 });
        else if (r.z2 === z && r.a2 === a) partners.push({ z: r.z1, a: r.a1 });
    });
    return partners;
};