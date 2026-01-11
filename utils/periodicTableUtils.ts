import { ELEMENT_GROUPS, ELEMENT_CATEGORIES, TITLES } from '../constants';

/**
 * Calculates the grid row and column for a given atomic number Z.
 * Returns coordinates offset for the display grid (R+1).
 */
export const getElementGridPosition = (z: number): { r: number, c: number } => {
    if (z === 0) return { r: 1, c: 1 };
    let r = 1, c = 1;
    if (z === 1) { r = 1; c = 1; }
    else if (z === 2) { r = 1; c = 18; }
    else if (z >= 3 && z <= 4) { r = 2; c = z - 2; }
    else if (z >= 5 && z <= 10) { r = 2; c = z + 8; }
    else if (z >= 11 && z <= 12) { r = 3; c = z - 10; }
    else if (z >= 13 && z <= 18) { r = 3; c = z; }
    else if (z >= 19 && z <= 36) { r = 4; c = z - 18; }
    else if (z >= 37 && z <= 54) { r = 5; c = z - 36; }
    else if (z >= 55 && z <= 56) { r = 6; c = z - 54; }
    else if (z >= 57 && z <= 71) { r = 8; c = z - 54; } 
    else if (z >= 72 && z <= 86) { r = 6; c = z - 68; }
    else if (z >= 87 && z <= 88) { r = 7; c = z - 86; }
    else if (z >= 89 && z <= 103) { r = 9; c = z - 86; } 
    else if (z >= 104 && z <= 118) { r = 7; c = z - 100; }
    else { r = 10; c = 1; }
    return { r: r + 1, c };
};

/**
 * Determines the style and naming category for a given atomic number Z.
 */
export const getElementCategoryInfo = (z: number): { name: string, class: string } => {
    if (z === 0) return ELEMENT_CATEGORIES.SPECIAL;
    
    if (ELEMENT_GROUPS[TITLES.NOBLE_GAS].includes(z)) return ELEMENT_CATEGORIES[TITLES.NOBLE_GAS];
    if (ELEMENT_GROUPS[TITLES.ALKALI_METAL].includes(z)) return ELEMENT_CATEGORIES[TITLES.ALKALI_METAL];
    if (ELEMENT_GROUPS[TITLES.ALKALINE_EARTH].includes(z)) return ELEMENT_CATEGORIES[TITLES.ALKALINE_EARTH];
    if (ELEMENT_GROUPS[TITLES.LANTHANIDE].includes(z)) return ELEMENT_CATEGORIES[TITLES.LANTHANIDE];
    if (ELEMENT_GROUPS[TITLES.ACTINIDE].includes(z)) return ELEMENT_CATEGORIES[TITLES.ACTINIDE];
    if (ELEMENT_GROUPS[TITLES.HALOGEN].includes(z)) return ELEMENT_CATEGORIES[TITLES.HALOGEN];
    if (ELEMENT_GROUPS[TITLES.METALLOID].includes(z)) return ELEMENT_CATEGORIES[TITLES.METALLOID];
    if (ELEMENT_GROUPS[TITLES.NON_METAL].includes(z)) return ELEMENT_CATEGORIES[TITLES.NON_METAL];
    if (ELEMENT_GROUPS[TITLES.POST_TRANSITION].includes(z)) return ELEMENT_CATEGORIES[TITLES.POST_TRANSITION];
    if (ELEMENT_GROUPS[TITLES.TRANSITION].includes(z)) return ELEMENT_CATEGORIES[TITLES.TRANSITION];
    
    return ELEMENT_CATEGORIES.OTHER;
};