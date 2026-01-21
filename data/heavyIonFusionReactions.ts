import { EntityType, SpecialReaction } from '../types';

/**
 * HEAVY ION INDUCED FUSION (Projectile Z >= 6)
 * Focus: Advanced stellar burning phases and laboratory Superheavy Element (SHE) synthesis.
 * Verified against JINR, GSI, and RIKEN experimental discovery papers.
 */
export const HEAVY_ION_FUSION_REACTIONS: SpecialReaction[] = [
    // --- Stellar Heavy Burning Phases (C, O, Si) ---
    // Carbon Burning Branch (Massive Stars)
    { z1: 6, a1: 12, z2: 6, a2: 12, productZ: 10, productA: 20, product2Z: 2, product2A: 4, emissions: [], message: "🌌 CARBON BURNING: C-C fusion (Alpha channel)", energyBonus: 5 },
    { z1: 6, a1: 12, z2: 6, a2: 12, productZ: 11, productA: 23, emissions: [EntityType.PROTON], message: "🌌 CARBON BURNING: C-C fusion (Proton channel)", energyBonus: 2 },
    { z1: 6, a1: 12, z2: 6, a2: 12, productZ: 12, productA: 23, emissions: [EntityType.NEUTRON], message: "🌌 CARBON BURNING: C-C fusion (Neutron channel)", energyBonus: 1 },
    
    // Oxygen Burning Branch
    { z1: 8, a1: 16, z2: 8, a2: 16, productZ: 14, productA: 28, product2Z: 2, product2A: 4, emissions: [], message: "🌌 OXYGEN BURNING: O-O fusion (Alpha channel)", energyBonus: 10 },
    { z1: 8, a1: 16, z2: 8, a2: 16, productZ: 15, productA: 31, emissions: [EntityType.PROTON], message: "🌌 OXYGEN BURNING: O-O fusion (Proton channel)", energyBonus: 8 },
    { z1: 8, a1: 16, z2: 8, a2: 16, productZ: 16, productA: 31, emissions: [EntityType.NEUTRON], message: "🌌 OXYGEN BURNING: O-O fusion (Neutron channel)", energyBonus: 2 },

    // --- Laboratory SHE Synthesis: Cold Fusion (Pb/Bi Targets) ---
    // Rutherfordium to Seaborgium (GSI/LBNL)
    { z1: 82, a1: 208, z2: 22, a2: 50, productZ: 104, productA: 257, emissions: [EntityType.NEUTRON], message: "🔬 COLD FUSION: Lead-Titanium (Rf-257 synthesis)", energyBonus: 80, isSuperheavy: true },
    { z1: 83, a1: 209, z2: 22, a2: 50, productZ: 105, productA: 258, emissions: [EntityType.NEUTRON], message: "🔬 COLD FUSION: Bismuth-Titanium (Db-258 synthesis)", energyBonus: 82, isSuperheavy: true },
    { z1: 82, a1: 208, z2: 24, a2: 54, productZ: 106, productA: 261, emissions: [EntityType.NEUTRON], message: "🔬 GSI FACILITY: 208Pb(54Cr,n)261Sg discovery", energyBonus: 85, isSuperheavy: true },
    
    // Hassium to Nihonium (GSI/RIKEN)
    { z1: 82, a1: 208, z2: 26, a2: 58, productZ: 108, productA: 265, emissions: [EntityType.NEUTRON], message: "🔬 GSI FACILITY: 208Pb(58Fe,n)265Hs success", energyBonus: 95, isSuperheavy: true },
    { z1: 83, a1: 209, z2: 26, a2: 58, productZ: 109, productA: 266, emissions: [EntityType.NEUTRON], message: "🔬 DISCOVERY: 209Bi(58Fe,n)266Mt achieved", energyBonus: 100, isSuperheavy: true },
    { z1: 82, a1: 208, z2: 28, a2: 64, productZ: 110, productA: 271, emissions: [EntityType.NEUTRON], message: "🔬 COLD FUSION: Lead-Nickel (Ds-271 synthesis)", energyBonus: 105, isSuperheavy: true },
    { z1: 83, a1: 209, z2: 28, a2: 64, productZ: 111, productA: 272, emissions: [EntityType.NEUTRON], message: "🔬 DISCOVERY: 209Bi(64Ni,n)272Rg success", energyBonus: 110, isSuperheavy: true },
    { z1: 82, a1: 208, z2: 30, a2: 70, productZ: 112, productA: 277, emissions: [EntityType.NEUTRON], message: "🔬 GSI ACHIEVEMENT: 208Pb(70Zn,n)277Cn success", energyBonus: 112, isSuperheavy: true },
    { z1: 83, a1: 209, z2: 30, a2: 70, productZ: 113, productA: 278, emissions: [EntityType.NEUTRON], message: "🇯🇵 RIKEN ACHIEVEMENT: 209Bi(70Zn,n)278Nh discovery", energyBonus: 113, isSuperheavy: true },

    // --- Laboratory SHE Synthesis: Hot Fusion (48Ca Beams) ---
    // Flerovium to Oganesson (JINR/Dubna Series)
    { z1: 94, a1: 244, z2: 20, a2: 48, productZ: 114, productA: 289, emissions: [EntityType.NEUTRON, EntityType.NEUTRON, EntityType.NEUTRON], message: "🌌 HOT FUSION: 48Ca beam on Pu (Fl-289 synthesis)", energyBonus: 114, isSuperheavy: true },
    { z1: 95, a1: 243, z2: 20, a2: 48, productZ: 115, productA: 288, emissions: [EntityType.NEUTRON, EntityType.NEUTRON, EntityType.NEUTRON], message: "🌌 HOT FUSION: 48Ca beam on Am (Mc-288 synthesis)", energyBonus: 115, isSuperheavy: true },
    { z1: 96, a1: 248, z2: 20, a2: 48, productZ: 116, productA: 293, emissions: [EntityType.NEUTRON, EntityType.NEUTRON, EntityType.NEUTRON], message: "🌌 HOT FUSION: 48Ca beam on Cm (Lv-293 synthesis)", energyBonus: 116, isSuperheavy: true },
    { z1: 97, a1: 249, z2: 20, a2: 48, productZ: 117, productA: 294, emissions: [EntityType.NEUTRON, EntityType.NEUTRON, EntityType.NEUTRON], message: "🌌 HOT FUSION: 48Ca beam on Bk (Ts-294 synthesis)", energyBonus: 117, isSuperheavy: true },
    { z1: 98, a1: 249, z2: 20, a2: 48, productZ: 118, productA: 294, emissions: [EntityType.NEUTRON, EntityType.NEUTRON, EntityType.NEUTRON], message: "🌌 HOT FUSION: 48Ca beam on Cf (Og-294 discovery)", energyBonus: 118, isSuperheavy: true },

    // --- Exotic / Future Attempts ---
    { z1: 22, a1: 50, z2: 96, a2: 248, productZ: 112, productA: 278, emissions: [], message: "🔬 TEST FUSION: Titanium on Curium experiment", energyBonus: 70 },
    { z1: 26, a1: 56, z2: 36, a2: 86, productZ: 62, productA: 142, emissions: [], message: "🔬 HEAVY ION FUSION: Iron-Krypton research", energyBonus: 40 },
];