import { EntityType, SpecialReaction } from '../types';

/**
 * ALPHA-INDUCED REACTIONS (4He Projectile)
 * Includes comprehensive isotope expansion for mid-to-heavy stable nuclides.
 * Verified against IAEA EXFOR / Q-value data.
 * Historical milestones like Rutherford/Chadwick are handled in historicalAndNeutronReactions.ts.
 */
export const ALPHA_INDUCED_REACTIONS: SpecialReaction[] = [
    // --- Light to Mid-Weight Elements (Z=8 to 49) ---
    { z1: 8, a1: 18, z2: 2, a2: 4, productZ: 10, productA: 21, emissions: [EntityType.NEUTRON], message: "🌌 NEUTRON SOURCE: 18O(a,n)21Ne stellar reaction", energyBonus: 1 },
    { z1: 9, a1: 19, z2: 2, a2: 4, productZ: 10, productA: 22, emissions: [EntityType.PROTON], message: "🧪 FLUORINE BURNING: 19F(a,p)22Ne path", energyBonus: 2 },
    { z1: 11, a1: 23, z2: 2, a2: 4, productZ: 12, productA: 26, emissions: [EntityType.PROTON], message: "🧪 SODIUM ACTIVATION: 23Na(a,p)26Mg path", energyBonus: 2 },
    { z1: 12, a1: 25, z2: 2, a2: 4, productZ: 14, productA: 28, emissions: [EntityType.NEUTRON], message: "🌟 MAGNESIUM BURNING: Alpha capture on Mg-25", energyBonus: 3 },
    { z1: 12, a1: 26, z2: 2, a2: 4, productZ: 14, productA: 29, emissions: [EntityType.NEUTRON], message: "🌟 MAGNESIUM BURNING: Alpha capture on Mg-26", energyBonus: 1 },
    { z1: 14, a1: 29, z2: 2, a2: 4, productZ: 16, productA: 32, emissions: [EntityType.NEUTRON], message: "🌟 SILICON BURNING: Alpha-induced sulfur path", energyBonus: 2 },
    { z1: 14, a1: 30, z2: 2, a2: 4, productZ: 16, productA: 33, emissions: [EntityType.NEUTRON], message: "🌟 SILICON BURNING: Alpha-induced sulfur path", energyBonus: 1 },
    { z1: 15, a1: 31, z2: 2, a2: 4, productZ: 16, productA: 34, emissions: [EntityType.PROTON], message: "🧪 PHOSPHORUS TARGET: 31P(a,p)34S reaction", energyBonus: 1 },
    { z1: 16, a1: 33, z2: 2, a2: 4, productZ: 18, productA: 36, emissions: [EntityType.NEUTRON], message: "🌟 SULFUR BURNING: Alpha capture on S-33", energyBonus: 4 },
    { z1: 16, a1: 34, z2: 2, a2: 4, productZ: 18, productA: 37, emissions: [EntityType.NEUTRON], message: "🌟 SULFUR BURNING: Alpha capture on S-34", energyBonus: 1 },
    { z1: 16, a1: 36, z2: 2, a2: 4, productZ: 18, productA: 39, emissions: [EntityType.NEUTRON], message: "🌟 SULFUR BURNING: Alpha capture on S-36", energyBonus: 1 },
    { z1: 21, a1: 45, z2: 2, a2: 4, productZ: 22, productA: 48, emissions: [EntityType.PROTON], message: "🧪 SCANDIUM TARGET: 45Sc(a,p)48Ti reaction", energyBonus: 2 },
    { z1: 23, a1: 51, z2: 2, a2: 4, productZ: 24, productA: 54, emissions: [EntityType.PROTON], message: "🧪 VANADIUM TARGET: 51V(a,p)54Cr reaction", energyBonus: 1 },
    { z1: 25, a1: 55, z2: 2, a2: 4, productZ: 26, productA: 58, emissions: [EntityType.PROTON], message: "🧪 MANGANESE TARGET: 55Mn(a,p)58Fe reaction", energyBonus: 1 },

    // --- p-Process Seed Nuclei (Z=34 to 48) ---
    { z1: 34, a1: 74, z2: 2, a2: 4, productZ: 36, productA: 78, emissions: [], message: "🌌 p-PROCESS: Selenium-74 alpha capture", energyBonus: 4 },
    { z1: 36, a1: 78, z2: 2, a2: 4, productZ: 38, productA: 82, emissions: [], message: "🌌 p-PROCESS: Krypton-78 alpha capture", energyBonus: 5 },
    { z1: 42, a1: 92, z2: 2, a2: 4, productZ: 44, productA: 96, emissions: [], message: "🌌 p-PROCESS: Molybdenum-92 alpha capture", energyBonus: 4 },
    { z1: 48, a1: 106, z2: 2, a2: 4, productZ: 50, productA: 110, emissions: [], message: "🌌 p-PROCESS: Cadmium-106 alpha capture", energyBonus: 3 },

    // --- Tin (Sn, Z=50) Isotope Expansion ---
    { z1: 50, a1: 112, z2: 2, a2: 4, productZ: 52, productA: 116, emissions: [], message: "🧪 ISOTOPE STUDY: 112Sn(a,gamma)116Te reaction", energyBonus: 4 },
    { z1: 50, a1: 114, z2: 2, a2: 4, productZ: 52, productA: 118, emissions: [], message: "🧪 ISOTOPE STUDY: 114Sn(a,gamma)118Te reaction", energyBonus: 4 },
    { z1: 50, a1: 115, z2: 2, a2: 4, productZ: 52, productA: 119, emissions: [], message: "🧪 ISOTOPE STUDY: 115Sn(a,gamma)119Te reaction", energyBonus: 4 },
    { z1: 50, a1: 116, z2: 2, a2: 4, productZ: 52, productA: 120, emissions: [], message: "🧪 ISOTOPE STUDY: 116Sn(a,gamma)120Te reaction", energyBonus: 4 },
    { z1: 50, a1: 117, z2: 2, a2: 4, productZ: 52, productA: 121, emissions: [], message: "🧪 TELLURIUM PRODUCTION: 117Sn(a,gamma)121Te", energyBonus: 6 },
    { z1: 50, a1: 118, z2: 2, a2: 4, productZ: 52, productA: 122, emissions: [], message: "🧪 ISOTOPE STUDY: 118Sn(a,gamma)122Te reaction", energyBonus: 4 },
    { z1: 50, a1: 119, z2: 2, a2: 4, productZ: 52, productA: 123, emissions: [], message: "🧪 ISOTOPE STUDY: 119Sn(a,gamma)123Te reaction", energyBonus: 4 },
    { z1: 50, a1: 120, z2: 2, a2: 4, productZ: 52, productA: 124, emissions: [], message: "🧪 ISOTOPE STUDY: 120Sn(a,gamma)124Te reaction", energyBonus: 4 },
    { z1: 50, a1: 122, z2: 2, a2: 4, productZ: 52, productA: 126, emissions: [], message: "🧪 ISOTOPE STUDY: 122Sn(a,gamma)126Te reaction", energyBonus: 4 },
    { z1: 50, a1: 124, z2: 2, a2: 4, productZ: 52, productA: 128, emissions: [], message: "🧪 ISOTOPE STUDY: 124Sn(a,gamma)128Te reaction", energyBonus: 4 },

    // --- Xenon (Xe, Z=54) Isotope Expansion ---
    { z1: 54, a1: 124, z2: 2, a2: 4, productZ: 56, productA: 128, emissions: [], message: "🧪 NOBLE GAS STUDY: 124Xe alpha capture", energyBonus: 5 },
    { z1: 54, a1: 126, z2: 2, a2: 4, productZ: 56, productA: 130, emissions: [], message: "🧪 NOBLE GAS STUDY: 126Xe alpha capture", energyBonus: 5 },
    { z1: 54, a1: 128, z2: 2, a2: 4, productZ: 56, productA: 132, emissions: [], message: "🧪 NOBLE GAS STUDY: 128Xe alpha capture", energyBonus: 5 },
    { z1: 54, a1: 129, z2: 2, a2: 4, productZ: 56, productA: 133, emissions: [], message: "🧪 NOBLE GAS STUDY: 129Xe alpha capture", energyBonus: 5 },
    { z1: 54, a1: 130, z2: 2, a2: 4, productZ: 56, productA: 134, emissions: [], message: "🧪 NOBLE GAS STUDY: 130Xe alpha capture", energyBonus: 5 },
    { z1: 54, a1: 131, z2: 2, a2: 4, productZ: 56, productA: 135, emissions: [], message: "🧪 NOBLE GAS STUDY: 131Xe alpha capture", energyBonus: 5 },
    { z1: 54, a1: 132, z2: 2, a2: 4, productZ: 56, productA: 136, emissions: [], message: "🧪 NOBLE GAS STUDY: 132Xe alpha capture", energyBonus: 5 },
    { z1: 54, a1: 134, z2: 2, a2: 4, productZ: 56, productA: 138, emissions: [], message: "🧪 NOBLE GAS STUDY: 134Xe alpha capture", energyBonus: 5 },
    { z1: 54, a1: 136, z2: 2, a2: 4, productZ: 56, productA: 140, emissions: [], message: "🧪 NOBLE GAS STUDY: 136Xe alpha capture", energyBonus: 4 },

    // --- Barium (Ba, Z=56) Isotope Expansion ---
    { z1: 56, a1: 130, z2: 2, a2: 4, productZ: 58, productA: 134, emissions: [], message: "🧪 ALKALINE EARTH STUDY: 130Ba alpha capture", energyBonus: 6 },
    { z1: 56, a1: 132, z2: 2, a2: 4, productZ: 58, productA: 136, emissions: [], message: "🧪 ALKALINE EARTH STUDY: 132Ba alpha capture", energyBonus: 6 },
    { z1: 56, a1: 134, z2: 2, a2: 4, productZ: 58, productA: 138, emissions: [], message: "🧪 ALKALINE EARTH STUDY: 134Ba alpha capture", energyBonus: 6 },
    { z1: 56, a1: 135, z2: 2, a2: 4, productZ: 58, productA: 139, emissions: [], message: "🧪 CERIUM PRODUCTION: Barium-Alpha fusion", energyBonus: 5 },
    { z1: 56, a1: 136, z2: 2, a2: 4, productZ: 58, productA: 140, emissions: [], message: "🧪 ALKALINE EARTH STUDY: 136Ba alpha capture", energyBonus: 6 },
    { z1: 56, a1: 137, z2: 2, a2: 4, productZ: 58, productA: 141, emissions: [], message: "🧪 ALKALINE EARTH STUDY: 137Ba alpha capture", energyBonus: 6 },
    { z1: 56, a1: 138, z2: 2, a2: 4, productZ: 58, productA: 142, emissions: [], message: "🧪 ALKALINE EARTH STUDY: 138Ba alpha capture", energyBonus: 6 },

    // --- Heavy Elements (Z=82) ---
    { z1: 82, a1: 204, z2: 2, a2: 4, productZ: 84, productA: 208, emissions: [], message: "🧪 POLONIUM SYNTHESIS: Lead-Alpha fusion", energyBonus: 4 },
    { z1: 82, a1: 206, z2: 2, a2: 4, productZ: 84, productA: 210, emissions: [], message: "🧪 POLONIUM SYNTHESIS: Lead-Alpha fusion", energyBonus: 5 },
    { z1: 82, a1: 207, z2: 2, a2: 4, productZ: 84, productA: 211, emissions: [], message: "🧪 POLONIUM SYNTHESIS: Lead-Alpha fusion", energyBonus: 6 },
    { z1: 82, a1: 208, z2: 2, a2: 4, productZ: 84, productA: 212, emissions: [], message: "🧪 POLONIUM SYNTHESIS: Lead-Alpha fusion", energyBonus: 7 },
];