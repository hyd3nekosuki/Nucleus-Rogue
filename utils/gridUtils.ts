
import { Position, GridEntity } from '../types';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants';

/**
 * Checks if a position is within the defined game grid.
 */
export const isWithinBounds = (pos: Position): boolean => {
    return pos.x >= 0 && pos.x < GRID_WIDTH && pos.y >= 0 && pos.y < GRID_HEIGHT;
};

/**
 * Checks if two positions are adjacent (including diagonals).
 */
export const isAdjacent = (posA: Position, posB: Position): boolean => {
    const dx = Math.abs(posA.x - posB.x);
    const dy = Math.abs(posA.y - posB.y);
    return (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);
};

/**
 * Finds an entity at a specific position. 
 * Returns the last entity added (top-most in rendering).
 */
export const findEntityAt = (entities: GridEntity[], pos: Position): { entity: GridEntity, index: number } | null => {
    for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        if (e.position.x === pos.x && e.position.y === pos.y) {
            return { entity: e, index: i };
        }
    }
    return null;
};

/**
 * Calculates a simple Manhattan path from start to end.
 */
export const calculateManhattanPath = (start: Position, end: Position): { dx: number, dy: number }[] => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const path: { dx: number, dy: number }[] = [];
    for (let i = 0; i < adx; i++) path.push({ dx: dx > 0 ? 1 : -1, dy: 0 });
    for (let i = 0; i < ady; i++) path.push({ dx: 0, dy: dy > 0 ? 1 : -1 });
    return path;
};
