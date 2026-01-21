import { EntityType, SpecialReaction } from '../types';

/**
 * HISTORICAL MILESTONES & NEUTRON INDUCED REACTIONS
 * This file contains the "Firsts" of nuclear physics and reactions triggered by Neutrons (Z=0).
 * Projects categorized as milestones are excluded from other specialized files to prevent duplicates.
 */
export const SPECIAL_REACTIONS: SpecialReaction[] = [
    // --- 1. Classical Historical Transmutations (The "Firsts") ---
    // These are physically Alpha/Proton induced but prioritized here as Milestones.
    { z1: 7, a1: 14, z2: 2, a2: 4, productZ: 8, productA: 17, emissions: [EntityType.PROTON], message: "⚛️ RUTHERFORD EXPERIMENT: First artificial transmutation (1919)", energyBonus: 1 },
    { z1: 4, a1: 9, z2: 2, a2: 4, productZ: 6, productA: 12, emissions: [EntityType.NEUTRON], message: "⚛️ CHADWICK DISCOVERY: The Neutron identified (1932)", energyBonus: 6 },
    { z1: 13, a1: 27, z2: 2, a2: 4, productZ: 15, productA: 30, emissions: [EntityType.NEUTRON], message: "⚛️ JOLIOT-CURIE: Artificial Radioactivity discovered (1934)", energyBonus: 2 },
    { z1: 3, a1: 7, z2: 1, a2: 1, productZ: 2, productA: 4, product2Z: 2, product2A: 4, emissions: [], message: "⚡ COCKCROFT-WALTON: First splitting of the atom (1932)", energyBonus: 17 },

    // --- 2. Fundamental Fusion Cycles (D-D, D-T, He3-He3) ---
    { z1: 1, a1: 2, z2: 1, a2: 2, productZ: 2, productA: 3, emissions: [EntityType.NEUTRON], message: "☀️ D-D FUSION: Solar proto-reaction (Helium-3 path)", energyBonus: 3 },
    { z1: 1, a1: 2, z2: 1, a2: 2, productZ: 1, productA: 3, emissions: [EntityType.PROTON], message: "🔥 D-D FUSION: Tritium production cycle induced", energyBonus: 4 },
    { z1: 1, a1: 2, z2: 1, a2: 3, productZ: 2, productA: 4, emissions: [EntityType.NEUTRON], message: "💥 D-T FUSION: Maximum energy density achieved!", energyBonus: 18 },
    { z1: 2, a1: 3, z2: 2, a2: 3, productZ: 2, productA: 4, emissions: [EntityType.PROTON, EntityType.PROTON], message: "☀️ SOLAR FUSION: ppI-chain step replicated!", energyBonus: 13 },
    { z1: 2, a1: 3, z2: 2, a2: 4, productZ: 4, productA: 7, emissions: [], message: "☀️ SOLAR FUSION: ppII-chain branch (Be-7 synthesis)", energyBonus: 1 },

    // --- 3. Neutron-Induced Reactions (Medical, Industrial & Cosmogenic) ---
    // Projectile Z=0 is unique to this file.
    { z1: 5, a1: 10, z2: 0, a2: 1, productZ: 3, productA: 7, product2Z: 2, product2A: 4, emissions: [], message: "🏥 BNCT: Boron Neutron Capture Therapy reaction", energyBonus: 3 },
    { z1: 7, a1: 14, z2: 0, a2: 1, productZ: 6, productA: 14, emissions: [EntityType.PROTON], message: "🌍 COSMOGENIC: Atmospheric Carbon-14 production", energyBonus: 1 },
    { z1: 26, a1: 56, z2: 0, a2: 1, productZ: 26, productA: 57, emissions: [], message: "🌌 s-PROCESS: Iron-56 neutron capture initiation", energyBonus: 8 },
    { z1: 42, a1: 98, z2: 0, a2: 1, productZ: 42, productA: 99, emissions: [], message: "🏥 MEDICAL ISOTOPE: Technetium-99m source activated", energyBonus: 6 },
    { z1: 79, a1: 197, z2: 0, a2: 1, productZ: 79, productA: 198, emissions: [], message: "⚛️ ACTIVATION: Gold-198 neutron capture induced", energyBonus: 7 },
    { z1: 92, a1: 238, z2: 0, a2: 1, productZ: 92, productA: 239, emissions: [], message: "⚛️ BREEDER CYCLE: Uranium-238 to Plutonium precursor", energyBonus: 5 },
    { z1: 3, a1: 6, z2: 0, a2: 1, productZ: 1, productA: 3, product2Z: 2, product2A: 4, emissions: [], message: "🔋 TRITIUM BREEDING: Fusion fuel cycle step replicated", energyBonus: 5 },
];