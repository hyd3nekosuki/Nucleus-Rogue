import { ELEMENT_GROUPS, ELEMENT_CATEGORIES } from '../constants';

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
    if (ELEMENT_GROUPS["Noble Gas"].includes(z)) return ELEMENT_CATEGORIES.NOBLE_GAS;
    if (ELEMENT_GROUPS["Alkali Metal"].includes(z)) return ELEMENT_CATEGORIES.ALKALI_METAL;
    if (ELEMENT_GROUPS["Alkaline Earth"].includes(z)) return ELEMENT_CATEGORIES.ALKALINE_EARTH;
    if (ELEMENT_GROUPS["Lanthanide"].includes(z)) return ELEMENT_CATEGORIES.LANTHANIDE;
    if (ELEMENT_GROUPS["Actinide"].includes(z)) return ELEMENT_CATEGORIES.ACTINIDE;
    if (ELEMENT_GROUPS["Halogen"].includes(z)) return ELEMENT_CATEGORIES.HALOGEN;
    if (ELEMENT_GROUPS["Metalloid"].includes(z)) return ELEMENT_CATEGORIES.METALLOID;
    if (ELEMENT_GROUPS["Non-metal"].includes(z)) return ELEMENT_CATEGORIES.NON_METAL;
    if (ELEMENT_GROUPS["Post-Transition"].includes(z)) return ELEMENT_CATEGORIES.POST_TRANSITION;
    if (ELEMENT_GROUPS["Transition"].includes(z)) return ELEMENT_CATEGORIES.TRANSITION;
    return ELEMENT_CATEGORIES.OTHER;
};
