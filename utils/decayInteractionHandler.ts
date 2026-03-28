
import { Position, GridEntity, EntityType, DecayMode, VisualEffect } from '../types';
import { LOG_MESSAGES } from '../constants/logMessageTextData';

/**
 * Calculates the entities and effects resulting from a particle-antiparticle annihilation.
 */
export const calculateAnnihilationSymmetry = (
    playerPos: Position,
    entities: GridEntity[],
    targetType: EntityType,
    currentTime: number
): {
    remainingEntities: GridEntity[];
    effectMode: DecayMode;
    removedId: string;
    extraMessages: string[];
} | null => {
    const nearbyAntiparticles = entities.filter(e => {
        if (e.type !== targetType) return false;
        const dx = Math.abs(e.position.x - playerPos.x);
        const dy = Math.abs(e.position.y - playerPos.y);
        return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
    });

    if (nearbyAntiparticles.length === 0) return null;

    const target = nearbyAntiparticles[Math.floor(Math.random() * nearbyAntiparticles.length)];
    const dx = target.position.x - playerPos.x;
    const dy = target.position.y - playerPos.y;

    const isHorizontal = dy === 0;
    const isVertical = dx === 0;
    const isDiag1 = dx === dy; 
    const isDiag2 = dx === -dy; 

    const remainingEntities = entities.filter(e => e.id !== target.id).map(e => {
        const edx = e.position.x - playerPos.x;
        const edy = e.position.y - playerPos.y;
        let onLine = false;
        if (isHorizontal && edy === 0) onLine = true;
        else if (isVertical && edx === 0) onLine = true;
        else if (isDiag1 && edx === edy) onLine = true;
        else if (isDiag2 && edx === -edy) onLine = true;
        if (onLine) return { ...e, isHighEnergy: true };
        return e;
    });

    let effectMode = isHorizontal ? DecayMode.GAMMA_RAY_H : DecayMode.GAMMA_RAY_V;
    if (isDiag1) effectMode = DecayMode.GAMMA_RAY_DIAG_TL_BR;
    else if (isDiag2) effectMode = DecayMode.GAMMA_RAY_DIAG_TR_BL;

    return {
        remainingEntities,
        effectMode,
        removedId: target.id,
        extraMessages: [LOG_MESSAGES.PHYSICS.ANNIHILATION_GAMMA(20000)]
    };
};

/**
 * Calculates a destruction radius for spontaneous fission shockwaves.
 */
export const calculateFissionShockwave = (
    playerPos: Position,
    entities: GridEntity[],
    radius: number = 2
): GridEntity[] => {
    return entities.filter(e => {
        // Protect friendly entities (Another Nuclides synthesized by player) from the shockwave
        if (e.isFriendly) return true;
        
        const dist = Math.sqrt(Math.pow(e.position.x - playerPos.x, 2) + Math.pow(e.position.y - playerPos.y, 2));
        return dist > radius; 
    });
};
