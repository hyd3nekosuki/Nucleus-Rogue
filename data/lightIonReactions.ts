import { EntityType, SpecialReaction } from '../types';

/**
 * LIGHT ION INDUCED REACTIONS
 * Projectiles: 1H (Proton), 2H (Deuteron), 3He.
 * Focus: Stellar Hydrogen burning, CNO cycle branches, and early experimental fusion.
 */
export const LIGHT_ION_REACTIONS: SpecialReaction[] = [
    // --- Hydrogen Fusion & Solar physics ---
    { z1: 1, a1: 2, z2: 2, a2: 3, productZ: 2, productA: 4, emissions: [EntityType.PROTON], message: "🌟 LIGHT ION FUSION: Deuterium-Helium-3 fusion achieved!", energyBonus: 18 },
    { z1: 4, a1: 7, z2: 1, a2: 1, productZ: 5, productA: 8, emissions: [], message: "☀️ SOLAR NEUTRINOS: Beryllium-7 proton capture (ppIII path)", energyBonus: 1 },
    { z1: 3, a1: 6, z2: 1, a2: 2, productZ: 2, productA: 4, product2Z: 2, product2A: 4, emissions: [], message: "⚡ ANEUTRONIC: Lithium-6 Deuteron fusion (2-alpha channel)", energyBonus: 22 },

    // --- CNO cycle Branches (Extended) ---
    { z1: 6, a1: 13, z2: 1, a2: 1, productZ: 7, productA: 14, emissions: [], message: "🌟 CNO CYCLE: Carbon-13 proton capture step", energyBonus: 7 },
    { z1: 8, a1: 17, z2: 1, a2: 1, productZ: 7, productA: 14, product2Z: 2, product2A: 4, emissions: [], message: "🌟 CNO cycle-II: Oxygen-17(p,a)Nitrogen-14 recycling", energyBonus: 1 },
    { z1: 8, a1: 17, z2: 1, a2: 1, productZ: 9, productA: 18, emissions: [], message: "🌟 CNO cycle-III: Oxygen-17 proton capture step", energyBonus: 6 },
    { z1: 8, a1: 18, z2: 1, a2: 1, productZ: 9, productA: 19, emissions: [], message: "🔬 PROTON CAPTURE: 18O(p,gamma)19F reaction", energyBonus: 8 },
    { z1: 9, a1: 19, z2: 1, a2: 1, productZ: 8, productA: 16, product2Z: 2, product2A: 4, emissions: [], message: "🌟 Ne-Na CYCLE: Fluorine-19 to Oxygen-16 recycling", energyBonus: 8 },

    // --- Ne-Na and Mg-Al cycles ---
    { z1: 10, a1: 20, z2: 1, a2: 1, productZ: 11, productA: 21, emissions: [], message: "🌟 Ne-Na CYCLE: Neon-20 proton capture ignition", energyBonus: 2 },
    { z1: 11, a1: 23, z2: 1, a2: 1, productZ: 12, productA: 24, emissions: [], message: "🌟 Ne-Na CYCLE: Sodium-23 proton capture step", energyBonus: 11 },
    { z1: 12, a1: 24, z2: 1, a2: 1, productZ: 13, productA: 25, emissions: [], message: "🌟 Mg-Al CYCLE: Magnesium-24 proton capture", energyBonus: 2 },
    { z1: 12, a1: 26, z2: 1, a2: 1, productZ: 13, productA: 27, emissions: [], message: "🌟 Mg-Al CYCLE: Magnesium-26 proton capture", energyBonus: 8 },

    // --- Helium-3 Projectile Exotic reactions ---
    { z1: 3, a1: 6, z2: 2, a2: 3, productZ: 2, productA: 4, product2Z: 2, product2A: 4, emissions: [EntityType.PROTON], message: "🔬 EXOTIC FUSION: Lithium-6 Helium-3 fusion achieved!", energyBonus: 16 },
    { z1: 2, a1: 3, z2: 6, a2: 12, productZ: 8, productA: 15, emissions: [], message: "🌌 STELLAR NUCLEOSYNTHESIS: He-3 capture on Carbon-12", energyBonus: 12 },
];