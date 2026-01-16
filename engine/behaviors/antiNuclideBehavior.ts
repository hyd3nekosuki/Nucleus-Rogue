
import { GridEntity, Position, EntityType } from '../../types';
import { isWithinBounds } from '../../utils/gridUtils';

/**
 * Handles the random walk movement of anti-nuclides across the grid.
 */
export const moveAntiNuclides = (entities: GridEntity[], playerPos: Position): GridEntity[] => {
    return entities.map(e => {
        if (e.type === EntityType.ANTI_NUCLIDE) {
            const dx = Math.floor(Math.random() * 3) - 1;
            const dy = Math.floor(Math.random() * 3) - 1;
            const nextPos: Position = { x: e.position.x + dx, y: e.position.y + dy };
            
            // Boundary and player collision check
            if (isWithinBounds(nextPos) && !(nextPos.x === playerPos.x && nextPos.y === playerPos.y)) {
                return { ...e, position: nextPos };
            }
        }
        return e;
    });
};

/**
 * Processes matter-anti-nuclide removal for particles occupying the same space as an anti-nuclide.
 */
export const consumeMatterWithAntiNuclides = (entities: GridEntity[]): GridEntity[] => {
    const antiNuclides = entities.filter(e => e.type === EntityType.ANTI_NUCLIDE);
    if (antiNuclides.length === 0) return entities;

    return entities.filter(e => {
        if (e.type === EntityType.ANTI_NUCLIDE) return true;
        // Erase any normal particle sharing a cell with an anti-nuclide
        return !antiNuclides.some(a => a.position.x === e.position.x && a.position.y === e.position.y);
    });
};
