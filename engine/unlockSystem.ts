import { ELEMENT_GROUPS } from '../constants/atomicData';
import { MAGIC_NUMBERS } from '../constants/physics';
import { BONUS_SCORES } from '../constants/economy';

import { DecayMode } from '../types';
import { getNuclideDataSync } from '../services/nuclideService';

export const processUnlocks = (
    currentUnlockedElements: number[], 
    currentUnlockedGroups: string[], 
    newZ: number,
    newA: number,
    isTransmutation: boolean = false,
    isAnnihilation: boolean = false,
    isNucleosynthesis: boolean = false,
    isTemporalInversion: boolean = false,
    comboScore: number = 0,
    isCoulombScattered: boolean = false,
    isFusionAchieved: boolean = false,
    isFissionAchieved: boolean = false,
    isZeroBarnAchieved: boolean = false,
    isBremsAchieved: boolean = false,
    betaPlusCount: number = 0,
    betaMinusCount: number = 0,
    isGluttonyAchieved: boolean = false
) => {
    let updatedElements = currentUnlockedElements;
    let updatedGroups = currentUnlockedGroups;
    let scoreBonus = 0;
    let messages: string[] = [];

    const nuclideData = getNuclideDataSync(newZ, newA);

    // 1. Element Unlock
    if (!currentUnlockedElements.includes(newZ) && newZ >= 0) {
        updatedElements = [...currentUnlockedElements, newZ].sort((a,b) => a-b);
        
        let trophyBonus = 0;
        if (newZ === 0) {
            trophyBonus = BONUS_SCORES.NEUTRON_0;
            messages.push(` 👑 HIDDEN TITLE: Neutron (n)! (+${trophyBonus.toLocaleString()} PTS)`);
        } else {
            trophyBonus = newZ * 1000;
            messages.push(` 🏆 NEW TITLE: Z=${newZ}! (+${trophyBonus.toLocaleString()} PTS)`);
        }
        scoreBonus += trophyBonus;
    }

    // 2. Special Hidden Title: Pair annihilation
    if (!updatedGroups.includes("Pair annihilation")) {
        if (isAnnihilation) {
            updatedGroups = [...updatedGroups, "Pair annihilation"];
            scoreBonus += BONUS_SCORES.PAIR_ANNIHILATION;
            messages.push(` ☯️ HIDDEN TITLE: Pair annihilation! (+${BONUS_SCORES.PAIR_ANNIHILATION.toLocaleString()} PTS)`);
        } else if (betaPlusCount >= 10) {
            updatedGroups = [...updatedGroups, "Pair annihilation"];
            scoreBonus += BONUS_SCORES.PAIR_ANNIHILATION;
            messages.push(` ☯️ HIDDEN TITLE: Pair annihilation! (Mastered β+ Emission) (+${BONUS_SCORES.PAIR_ANNIHILATION.toLocaleString()} PTS)`);
        }
    }

    // Special Hidden Title: Neutronization
    if (!updatedGroups.includes("Neutronization") && betaMinusCount >= 20) {
        updatedGroups = [...updatedGroups, "Neutronization"];
        scoreBonus += BONUS_SCORES.NEUTRONIZATION;
        messages.push(` ⚪ HIDDEN TITLE: Neutronization! (Mastered p + e- → n reaction) (+${BONUS_SCORES.NEUTRONIZATION.toLocaleString()} PTS)`);
    }

    // 3. Special Hidden Title: Exp. Replicate
    if (isTransmutation && !updatedGroups.includes("Exp. Replicate")) {
        updatedGroups = [...updatedGroups, "Exp. Replicate"];
        scoreBonus += BONUS_SCORES.EXP_REPLICATE_TITLE;
        messages.push(` ⚛️ HIDDEN TITLE: Exp. Replicate! (+${BONUS_SCORES.EXP_REPLICATE_TITLE.toLocaleString()} PTS)`);
    }

    // 4. Special Hidden Title: Nucleosynthesis
    if (isNucleosynthesis && !updatedGroups.includes("Nucleosynthesis")) {
        updatedGroups = [...updatedGroups, "Nucleosynthesis"];
        scoreBonus += BONUS_SCORES.NUCLEOSYNTHESIS_TITLE;
        messages.push(` 🌟 HIDDEN TITLE: Nucleosynthesis! The Creation of Elements. (+${BONUS_SCORES.NUCLEOSYNTHESIS_TITLE.toLocaleString()} PTS)`);
    }

    // 5. Special Hidden Title: Unknown
    // Triggered when entering a nuclide with unmeasured/unspecified decay mode ('?') for the first time
    if (nuclideData.exists && nuclideData.decayModes.includes(DecayMode.UNKNOWN) && !updatedGroups.includes("Unknown")) {
        updatedGroups = [...updatedGroups, "Unknown"];
        scoreBonus += BONUS_SCORES.UNKNOWN;
        messages.push(` ❔ HIDDEN TITLE: Unknown! Encountered an unmeasured decay path. (+${BONUS_SCORES.UNKNOWN.toLocaleString()} PTS)`);
    }

    // 6. Special Hidden Title: Temporal Inversion
    if (isTemporalInversion) {
        const inversionBonus = comboScore * 10;
        if (!updatedGroups.includes("Temporal Inversion")) {
            updatedGroups = [...updatedGroups, "Temporal Inversion"];
            messages.push(` ⏱ HIDDEN TITLE: Temporal Inversion. (+${inversionBonus.toLocaleString()} PTS 10x Bonus!)`);
        } else {
            messages.push(` ⏱ TEMPORAL INVERSION: 10x Combo Score! (+${inversionBonus.toLocaleString()} PTS)`);
        }
        scoreBonus += inversionBonus;
    }

    // 8. Special Hidden Title: Fusion
    if (isFusionAchieved && !updatedGroups.includes("Fusion")) {
        updatedGroups = [...updatedGroups, "Fusion"];
        scoreBonus += BONUS_SCORES.FUSION_TITLE;
        messages.push(` 💥 HIDDEN TITLE: Fusion! (+${BONUS_SCORES.FUSION_TITLE.toLocaleString()} PTS)`);
    }

    // 9. Special Hidden Title: Fission
    if (isFissionAchieved && !updatedGroups.includes("Fission")) {
        updatedGroups = [...updatedGroups, "Fission"];
        scoreBonus += BONUS_SCORES.FISSION_TITLE;
        messages.push(` ☢️ HIDDEN TITLE: Fission! Breaking the Nucleus. (+${BONUS_SCORES.FISSION_TITLE.toLocaleString()} PTS)`);
    }

    // 10. Special Hidden Title: zero barn
    if (isZeroBarnAchieved && !updatedGroups.includes("zero barn")) {
        updatedGroups = [...updatedGroups, "zero barn"];
        scoreBonus += BONUS_SCORES.ZERO_BARN;
        messages.push(` 🌑 HIDDEN TITLE: zero barn! Neutrons flow through you. (+${BONUS_SCORES.ZERO_BARN.toLocaleString()} PTS)`);
    }

    // 11. Special Hidden Title: Electron scattering
    if (isBremsAchieved && !updatedGroups.includes("Electron scattering")) {
        updatedGroups = [...updatedGroups, "Electron scattering"];
        scoreBonus += BONUS_SCORES.ELECTRON_SCATTERING;
        messages.push(` ↪️ HIDDEN TITLE: Electron scattering! Repelling electrons at low stability! (+${BONUS_SCORES.ELECTRON_SCATTERING.toLocaleString()} PTS)`);
    }

    // NEW: Special Hidden Title: Gluttony
    if (isGluttonyAchieved && !updatedGroups.includes("Gluttony")) {
        updatedGroups = [...updatedGroups, "Gluttony"];
        scoreBonus += BONUS_SCORES.GLUTTONY;
        messages.push(` 🕳️ HIDDEN TITLE: Gluttony! The grid has been consumed. (+${BONUS_SCORES.GLUTTONY.toLocaleString()} PTS)`);
    }

    // 12. Group Unlock Check
    Object.entries(ELEMENT_GROUPS).forEach(([groupName, groupZs]) => {
        if (!updatedGroups.includes(groupName)) {
            const allFound = groupZs.every(z => updatedElements.includes(z));
            if (allFound) {
                updatedGroups = [...updatedGroups, groupName];
                scoreBonus += BONUS_SCORES.GRANDMASTER_SERIES;
                messages.push(` 👑 GRANDMASTER: ${groupName} Series Completed! (+${BONUS_SCORES.GRANDMASTER_SERIES.toLocaleString()} PTS)`);
            }
        }
    });

    // 13. Magic Number Checks
    const newN = newA - newZ;
    const isMagicZ = MAGIC_NUMBERS.includes(newZ);
    const isMagicN = MAGIC_NUMBERS.includes(newN);

    if (isMagicZ && isMagicN) {
        scoreBonus += BONUS_SCORES.DOUBLE_MAGIC;
        messages.push(` 🧙‍♂️✨ DOUBLY MAGIC NUCLEUS! (Z=${newZ}, N=${newN}) (+${BONUS_SCORES.DOUBLE_MAGIC.toLocaleString()} PTS)`);
    } else {
        if (isMagicZ) {
            scoreBonus += BONUS_SCORES.MAGIC_SHELL;
            messages.push(` ✨ MAGIC PROTON SHELL CLOSED (Z=${newZ})! (+${BONUS_SCORES.MAGIC_SHELL.toLocaleString()} PTS)`);
        }
        if (isMagicN) {
            scoreBonus += BONUS_SCORES.MAGIC_SHELL;
            messages.push(` ✨ MAGIC NEUTRON SHELL CLOSED (N=${newN})! (+${BONUS_SCORES.MAGIC_SHELL.toLocaleString()} PTS)`);
        }
    }

    return { updatedElements, updatedGroups, scoreBonus, messages };
};