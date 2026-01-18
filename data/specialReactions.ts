import { EntityType } from '../types';

export interface SpecialReaction {
    z1: number;
    a1: number;
    z2: number;
    a2: number;
    productZ: number;
    productA: number;
    product2Z?: number; // Secondary nuclide product
    product2A?: number;
    emissions: EntityType[]; // Remaining raw particle emissions
    message: string;
    energyBonus: number; // Q-value in MeV (Rounded to Integer)
    isSuperheavy?: boolean; // Flag to trigger enhanced SHE synthesis visuals
}

/**
 * Database of specific nuclide-nuclide interactions based on scientific history and astrophysics.
 * Every entry now has a unique, descriptive message for maximum scientific immersion.
 */
export const SPECIAL_REACTIONS: SpecialReaction[] = [
    // --- 1. Classical Historical Transmutations ---
    { z1: 7, a1: 14, z2: 2, a2: 4, productZ: 8, productA: 17, emissions: [EntityType.PROTON], message: "⚛️ RUTHERFORD EXPERIMENT: First artificial transmutation (1919)", energyBonus: 10 },
    { z1: 4, a1: 9, z2: 2, a2: 4, productZ: 6, productA: 12, emissions: [EntityType.NEUTRON], message: "⚛️ CHADWICK DISCOVERY: The Neutron identified (1932)", energyBonus: 6 },
    { z1: 13, a1: 27, z2: 2, a2: 4, productZ: 15, productA: 30, emissions: [EntityType.NEUTRON], message: "⚛️ JOLIOT-CURIE: Artificial Radioactivity discovered (1934)", energyBonus: 25 },
    { z1: 3, a1: 7, z2: 1, a2: 1, productZ: 2, productA: 4, product2Z: 2, product2A: 4, emissions: [], message: "⚡ COCKCROFT-WALTON: First splitting of the atom (1932)", energyBonus: 17 },

    // --- 2. Solar & Applied Fusion (H/He/Li focus) ---
    { z1: 1, a1: 2, z2: 1, a2: 2, productZ: 2, productA: 3, emissions: [EntityType.NEUTRON], message: "☀️ D-D FUSION: Solar proto-reaction (Helium-3 path)", energyBonus: 3 },
    { z1: 1, a1: 2, z2: 1, a2: 2, productZ: 1, productA: 3, emissions: [EntityType.PROTON], message: "🔥 D-D FUSION: Tritium production cycle induced", energyBonus: 4 },
    { z1: 1, a1: 2, z2: 1, a2: 3, productZ: 2, productA: 4, emissions: [EntityType.NEUTRON], message: "💥 D-T FUSION: Maximum energy density achieved!", energyBonus: 18 },
    { z1: 2, a1: 3, z2: 2, a2: 3, productZ: 2, productA: 4, emissions: [EntityType.PROTON, EntityType.PROTON], message: "☀️ SOLAR FUSION: ppI-chain step replicated!", energyBonus: 13 },
    { z1: 2, a1: 3, z2: 2, a2: 4, productZ: 4, productA: 7, emissions: [], message: "☀️ SOLAR FUSION: ppII-chain branch (Be-7 synthesis)", energyBonus: 2 },
    { z1: 3, a1: 6, z2: 1, a2: 1, productZ: 2, productA: 4, product2Z: 2, product2A: 3, emissions: [], message: "⚡ ANEUTRONIC FUSION: Clean Lithium-Proton reaction", energyBonus: 4 },
    { z1: 5, a1: 11, z2: 1, a2: 1, productZ: 2, productA: 4, product2Z: 2, product2A: 4, emissions: [EntityType.PROTON, EntityType.PROTON, EntityType.NEUTRON, EntityType.NEUTRON], message: "🛡️ ANEUTRONIC: Clean Boron fusion (p-11B)", energyBonus: 9 },
    { z1: 3, a1: 6, z2: 0, a2: 1, productZ: 1, productA: 3, product2Z: 2, product2A: 4, emissions: [], message: "🔋 TRITIUM BREEDING: Fusion fuel cycle step replicated", energyBonus: 5 },

    // --- 3. Alpha Ladder (The Stairway to the Iron Peak) ---
    { z1: 4, a1: 8, z2: 2, a2: 4, productZ: 6, productA: 12, emissions: [], message: "🌟 HOYLE STATE: Triple-Alpha Carbon synthesis!", energyBonus: 7 },
    { z1: 6, a1: 12, z2: 2, a2: 4, productZ: 8, productA: 16, emissions: [], message: "🌟 ALPHA PROCESS: Carbon to Oxygen burning", energyBonus: 7 },
    { z1: 8, a1: 16, z2: 2, a2: 4, productZ: 10, productA: 20, emissions: [], message: "🌟 ALPHA PROCESS: Neon synthesized!", energyBonus: 5 },
    { z1: 10, a1: 20, z2: 2, a2: 4, productZ: 12, productA: 24, emissions: [], message: "🌟 ALPHA PROCESS: Magnesium synthesized!", energyBonus: 9 },
    { z1: 12, a1: 24, z2: 2, a2: 4, productZ: 14, productA: 28, emissions: [], message: "🌟 ALPHA PROCESS: Silicon synthesized!", energyBonus: 10 },
    { z1: 14, a1: 28, z2: 2, a2: 4, productZ: 16, productA: 32, emissions: [], message: "🌟 ALPHA PROCESS: Sulfur synthesized!", energyBonus: 7 },
    { z1: 16, a1: 32, z2: 2, a2: 4, productZ: 18, productA: 36, emissions: [], message: "🌟 ALPHA PROCESS: Argon synthesized!", energyBonus: 7 },
    { z1: 18, a1: 36, z2: 2, a2: 4, productZ: 20, productA: 40, emissions: [], message: "🌟 ALPHA PROCESS: Calcium synthesized!", energyBonus: 7 },
    { z1: 20, a1: 40, z2: 2, a2: 4, productZ: 22, productA: 44, emissions: [], message: "🌟 ALPHA PROCESS: Titanium synthesized!", energyBonus: 5 },
    { z1: 22, a1: 44, z2: 2, a2: 4, productZ: 24, productA: 48, emissions: [], message: "🌟 ALPHA PROCESS: Chromium synthesized!", energyBonus: 8 },
    { z1: 24, a1: 48, z2: 2, a2: 4, productZ: 26, productA: 52, emissions: [], message: "🌟 ALPHA PROCESS: Iron synthesized!", energyBonus: 8 },
    { z1: 26, a1: 52, z2: 2, a2: 4, productZ: 28, productA: 56, emissions: [], message: "🌟 ALPHA PROCESS: Nickel-56 (Iron peak limit)!", energyBonus: 10 },

    // --- 4. Massive Star Processes (Carbon/Oxygen Burning & CNO) ---
    { z1: 6, a1: 12, z2: 6, a2: 12, productZ: 12, productA: 24, emissions: [], message: "🌌 CARBON BURNING: Core ignition achieved!", energyBonus: 14 },
    { z1: 8, a1: 16, z2: 8, a2: 16, productZ: 16, productA: 32, emissions: [], message: "🌌 OXYGEN BURNING: Silicon-group synthesis!", energyBonus: 16 },
    { z1: 14, a1: 28, z2: 14, a2: 28, productZ: 28, productA: 56, emissions: [], message: "🌌 SILICON BURNING: Reaching the binding energy limit!", energyBonus: 20 },
    { z1: 7, a1: 15, z2: 1, a2: 1, productZ: 6, productA: 12, product2Z: 2, product2A: 4, emissions: [], message: "🌟 CNO CYCLE: Catalyst Nitrogen-15 recycled to Carbon!", energyBonus: 5 },
    { z1: 6, a1: 12, z2: 1, a2: 1, productZ: 7, productA: 13, emissions: [], message: "🌟 CNO CYCLE: Carbon-12 proton capture", energyBonus: 2 },
    { z1: 7, a1: 14, z2: 1, a2: 1, productZ: 8, productA: 15, emissions: [], message: "🌟 CNO CYCLE: Nitrogen-14 bottleneck step", energyBonus: 7 },
    { z1: 12, a1: 25, z2: 1, a2: 1, productZ: 13, productA: 26, emissions: [], message: "🌟 Al-Mg CYCLE: Aluminum-26 cosmic tracer synthesized!", energyBonus: 6 },

    // --- 5. SHE Synthesis (Fusion-Evaporation Historical Routes) ---
    { z1: 94, a1: 239, z2: 2, a2: 4, productZ: 96, productA: 242, emissions: [EntityType.NEUTRON], message: "🧪 TRANSURANIC: Curium synthesized from Plutonium!", energyBonus: 50 },
    { z1: 95, a1: 241, z2: 2, a2: 4, productZ: 97, productA: 243, emissions: [EntityType.NEUTRON, EntityType.NEUTRON], message: "🧪 LBNL DISCOVERY: Berkelium synthesized (241Am+a)", energyBonus: 35 },
    { z1: 92, a1: 238, z2: 1, a2: 2, productZ: 93, productA: 239, emissions: [EntityType.NEUTRON], message: "⚛️ NEPTUNIUM DISCOVERY: First transuranic (1940)", energyBonus: 45 },
    { z1: 92, a1: 238, z2: 1, a2: 2, productZ: 94, productA: 238, emissions: [EntityType.NEUTRON, EntityType.NEUTRON], message: "⚛️ PLUTONIUM DISCOVERY: Synthesis of the 94th element", energyBonus: 60 },
    { z1: 96, a1: 242, z2: 2, a2: 4, productZ: 98, productA: 245, emissions: [EntityType.NEUTRON], message: "🧪 CALIFORNIUM DISCOVERY: Curium target success!", energyBonus: 40 },
    { z1: 96, a1: 244, z2: 6, a2: 12, productZ: 102, productA: 254, emissions: [EntityType.NEUTRON, EntityType.NEUTRON], message: "🧪 NOBELIUM SYNTHESIS: Heavy ion fusion success!", energyBonus: 80, isSuperheavy: true },
    { z1: 98, a1: 249, z2: 5, a2: 11, productZ: 103, productA: 258, emissions: [EntityType.NEUTRON, EntityType.NEUTRON], message: "🧪 LAWRENCIUM: Boron beam on Californium!", energyBonus: 85, isSuperheavy: true },
    { z1: 82, a1: 208, z2: 24, a2: 54, productZ: 106, productA: 260, emissions: [EntityType.NEUTRON, EntityType.NEUTRON], message: "🧪 SEABORGIUM SYNTHESIS: Chromium on Lead target!", energyBonus: 95, isSuperheavy: true },
    { z1: 82, a1: 208, z2: 30, a2: 70, productZ: 112, productA: 277, emissions: [EntityType.NEUTRON], message: "🇩🇪 GSI ACHIEVEMENT: Copernicium synthesized!", energyBonus: 112, isSuperheavy: true },
    { z1: 83, a1: 209, z2: 30, a2: 70, productZ: 113, productA: 278, emissions: [EntityType.NEUTRON], message: "🇯🇵 RIKEN ACHIEVEMENT: Nihonium synthesized!", energyBonus: 113, isSuperheavy: true },
    { z1: 94, a1: 244, z2: 20, a2: 48, productZ: 114, productA: 289, emissions: [EntityType.NEUTRON, EntityType.NEUTRON, EntityType.NEUTRON], message: "🌌 FLEROVIUM SYNTHESIS: 48Ca beam on Plutonium", energyBonus: 114, isSuperheavy: true },
    { z1: 95, a1: 243, z2: 20, a2: 48, productZ: 115, productA: 288, emissions: [EntityType.NEUTRON, EntityType.NEUTRON, EntityType.NEUTRON], message: "🌌 MOSCOVIUM SYNTHESIS: Americium target bombardment", energyBonus: 115, isSuperheavy: true },
    { z1: 96, a1: 248, z2: 20, a2: 48, productZ: 116, productA: 293, emissions: [EntityType.NEUTRON, EntityType.NEUTRON, EntityType.NEUTRON], message: "🌌 LIVERMORIUM SYNTHESIS: Curium-Calcium fusion", energyBonus: 116, isSuperheavy: true },
    { z1: 98, a1: 249, z2: 20, a2: 48, productZ: 118, productA: 294, emissions: [EntityType.NEUTRON, EntityType.NEUTRON, EntityType.NEUTRON], message: "🌌 OGANESSON SYNTHESIS: The edge of the Periodic Table!", energyBonus: 118, isSuperheavy: true },

    // --- 6. Exotic, Medical & Industrial Physics ---
    { z1: 4, a1: 9, z2: 1, a2: 1, productZ: 3, productA: 6, product2Z: 2, product2A: 4, emissions: [], message: "⚛️ SPALLATION: Beryllium broken by proton impact!", energyBonus: 2 },
    { z1: 8, a1: 18, z2: 1, a2: 1, productZ: 9, productA: 18, emissions: [EntityType.NEUTRON], message: "🏥 MEDICAL PHYSICS: Fluorine-18 PET tracer synthesized!", energyBonus: 15 },
    { z1: 10, a1: 20, z2: 1, a2: 2, productZ: 9, productA: 18, product2Z: 2, product2A: 4, emissions: [], message: "🏥 PET SCAN SOURCE: F-18 from Neon-20 target", energyBonus: 12 },
    { z1: 26, a1: 56, z2: 0, a2: 1, productZ: 26, productA: 57, emissions: [], message: "🌌 s-PROCESS: Iron-56 neutron capture initiation", energyBonus: 8 },
    { z1: 42, a1: 98, z2: 0, a2: 1, productZ: 42, productA: 99, emissions: [], message: "🏥 MEDICAL ISOTOPE: Technetium-99m source activated", energyBonus: 6 },
    { z1: 79, a1: 197, z2: 0, a2: 1, productZ: 79, productA: 198, emissions: [], message: "⚛️ ACTIVATION: Gold-198 neutron capture induced", energyBonus: 7 },
    { z1: 92, a1: 238, z2: 0, a2: 1, productZ: 92, productA: 239, emissions: [], message: "⚛️ BREEDER CYCLE: Uranium-238 to Plutonium precursor", energyBonus: 5 },
    { z1: 10, a1: 22, z2: 2, a2: 4, productZ: 12, productA: 25, emissions: [EntityType.NEUTRON], message: "🌌 S-PROCESS SOURCE: Neon-22 neutron generator", energyBonus: 5 },
    { z1: 6, a1: 13, z2: 2, a2: 4, productZ: 8, productA: 16, emissions: [EntityType.NEUTRON], message: "🌌 S-PROCESS SOURCE: Carbon-13 neutron flux induced", energyBonus: 2 },
    { z1: 7, a1: 14, z2: 0, a2: 1, productZ: 6, productA: 14, emissions: [EntityType.PROTON], message: "🌍 COSMOGENIC: Atmospheric Carbon-14 production", energyBonus: 1 },
    { z1: 5, a1: 10, z2: 0, a2: 1, productZ: 3, productA: 7, product2Z: 2, product2A: 4, emissions: [], message: "🏥 BNCT: Boron Neutron Capture Therapy reaction", energyBonus: 3 }
];

/**
 * Searches for a special reaction matching the two input nuclides.
 * Symmetry is handled (a+b and b+a are treated the same).
 */
export const findSpecialReaction = (z1: number, a1: number, z2: number, a2: number): SpecialReaction | null => {
    return SPECIAL_REACTIONS.find(r => 
        (r.z1 === z1 && r.a1 === a1 && r.z2 === z2 && r.a2 === a2) ||
        (r.z1 === z2 && r.a1 === a2 && r.z2 === z1 && r.a2 === a1)
    ) || null;
};

/**
 * Finds all potential reaction partners for a given nuclide (z, a).
 * Used for prioritized mid-boss spawning logic in randomEvents.ts.
 */
export const findReactionPartners = (z: number, a: number): { z: number, a: number }[] => {
    const partners: { z: number, a: number }[] = [];
    SPECIAL_REACTIONS.forEach(r => {
        if (r.z1 === z && r.a1 === a) partners.push({ z: r.z2, a: r.a2 });
        else if (r.z2 === z && r.a2 === a) partners.push({ z: r.z1, a: r.a1 });
    });
    return partners;
};
