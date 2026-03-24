import { EntityType, GridEntity, Position } from '../types';
import { NEUTRON_CROSS_SECTIONS } from '../data/neutronReactions';
import { getPromptNeutronCount, getFissionFragmentOutcome } from './fissionModel';
import { findNearbyFreeCell } from '../engine/core/discoveryEngine';

/**
 * Checks if a nuclide is fissile based on (n,f) cross section.
 */
export const isFissile = (z: number, a: number): boolean => {
    const data = NEUTRON_CROSS_SECTIONS[`${z}-${a}`];
    if (!data || !data.reactions) return false;
    const nf = data.reactions['n,f'];
    if (!nf) return false;
    // Fissile if any cross section (normal or high energy) is > 0
    return nf.some(xs => xs > 0);
};

/**
 * Processes the fission chain reaction event.
 * 
 * Logic:
 * 0. Target another nuclides: Those outside 2-tile range and are fissile.
 * 1. If N >= 1 neutrons released, one is absorbed by one target. M = N - 1.
 * 2. Target undergoes fission -> 2 fragments + L neutrons. M = M + L.
 * 3. Repeat if M >= 1 and targets exist.
 */
export const processFissionChainReaction = (
    initialNeutronCount: number,
    playerPos: Position,
    gridEntities: GridEntity[]
): {
    finalEntities: GridEntity[];
    remainingNeutrons: number;
    chainReactionCount: number;
} => {
    let currentEntities = [...gridEntities];
    let m = initialNeutronCount;
    let chainReactionCount = 0;

    if (m <= 0) {
        return { finalEntities: currentEntities, remainingNeutrons: 0, chainReactionCount: 0 };
    }

    while (m >= 1) {
        // Find target another nuclides:
        // - Outside 2-tile range of player
        // - Fissile
        const targetNuclides = currentEntities.filter(e => {
            if (e.type !== EntityType.ANOTHER_NUCLIDE) return false;
            const dist = Math.sqrt(Math.pow(e.position.x - playerPos.x, 2) + Math.pow(e.position.y - playerPos.y, 2));
            if (dist <= 2) return false;
            return isFissile(e.z || 0, e.a || 0);
        });

        if (targetNuclides.length === 0) break;

        // One neutron is absorbed by one target
        m -= 1;
        
        // Pick one target
        const target = targetNuclides[Math.floor(Math.random() * targetNuclides.length)];
        const targetIndex = currentEntities.findIndex(e => e.id === target.id);
        
        // Remove target
        currentEntities.splice(targetIndex, 1);
        chainReactionCount++;

        // Fission of target
        const l = getPromptNeutronCount(target.z || 0, target.a || 0);
        m += l;

        const fragment = getFissionFragmentOutcome(target.z || 0, target.a || 0, l);
        const byproductZ = (target.z || 0) - fragment.z;
        const byproductA = (target.a || 0) - fragment.a - l;

        // Fragment 1
        const pos1 = findNearbyFreeCell(target.position, currentEntities, playerPos);
        currentEntities.push({
            id: `fission-frag-1-${chainReactionCount}-${Math.random().toString(36).substr(2, 5)}`,
            type: EntityType.ANOTHER_NUCLIDE,
            position: pos1,
            spawnTurn: target.spawnTurn,
            isHighEnergy: false,
            z: fragment.z,
            a: fragment.a,
            isFriendly: target.isFriendly
        });

        // Fragment 2 (Byproduct)
        if (byproductZ > 0 && byproductA >= byproductZ) {
            const pos2 = findNearbyFreeCell(target.position, currentEntities, playerPos);
            currentEntities.push({
                id: `fission-frag-2-${chainReactionCount}-${Math.random().toString(36).substr(2, 5)}`,
                type: EntityType.ANOTHER_NUCLIDE,
                position: pos2,
                spawnTurn: target.spawnTurn,
                isHighEnergy: false,
                z: byproductZ,
                a: byproductA,
                isFriendly: target.isFriendly
            });
        }
    }

    return {
        finalEntities: currentEntities,
        remainingNeutrons: m,
        chainReactionCount
    };
};
