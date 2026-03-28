import { ELEMENT_GROUPS } from '../constants/atomicData';
import { MAGIC_NUMBERS } from '../constants/physics';
import { BONUS_SCORES } from '../constants/economy';
import { TITLES } from '../constants/titles';
import { LOG_MESSAGES } from '../constants/logMessageTextData';

import { DecayMode } from '../types';
import { getNuclideDataSync } from '../services/nuclideService';

export const processUnlocks = (
    currentUnlockedElements: number[], 
    currentUnlockedGroups: string[], 
    newZ: number | null,
    newA: number | null,
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
    isGluttonyAchieved: boolean = false,
    isDaredevilAchieved: boolean = false,
    isTimeStopped: boolean = false,
    isQuantumOverride: boolean = false,
    playerLevel: number = 0,
    isPositronAbsorbed: boolean = false
) => {
    let updatedElements = currentUnlockedElements;
    let updatedGroups = currentUnlockedGroups;
    let scoreBonus = 0;
    let messages: string[] = [];

    const nuclideData = getNuclideDataSync(newZ, newA);

    if (nuclideData.exists) {
        // 1. Element Unlock
        const isAlreadyUnlocked = currentUnlockedElements.includes(newZ);
        if (!isAlreadyUnlocked && newZ >= 0) {
            updatedElements = [...currentUnlockedElements, newZ].sort((a,b) => a-b);
            let trophyBonus = 0;
            if (newZ === 0) {
                trophyBonus = BONUS_SCORES.NEUTRON_0;
                messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_NEUTRON(trophyBonus));
            } else {
                trophyBonus = newZ * 1000;
                messages.push(LOG_MESSAGES.UNLOCKS.NEW_TITLE_Z(newZ, trophyBonus));
            }
            scoreBonus += trophyBonus;
        }

        // 5. Special Hidden Title: Unknown
        if (nuclideData.decayModes.includes(DecayMode.UNKNOWN) && !updatedGroups.includes(TITLES.UNKNOWN)) {
            updatedGroups = [...updatedGroups, TITLES.UNKNOWN];
            scoreBonus += BONUS_SCORES.UNKNOWN;
            messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_UNKNOWN(BONUS_SCORES.UNKNOWN));
        }

        // 12. Group Unlock Check
        Object.entries(ELEMENT_GROUPS).forEach(([groupName, groupZs]) => {
            if (!updatedGroups.includes(groupName)) {
                const allFound = groupZs.every(z => updatedElements.includes(z));
                if (allFound) {
                    updatedGroups = [...updatedGroups, groupName];
                    scoreBonus += BONUS_SCORES.GRANDMASTER_SERIES;
                    messages.push(LOG_MESSAGES.UNLOCKS.GRANDMASTER_SERIES(groupName, BONUS_SCORES.GRANDMASTER_SERIES));
                }
            }
        });

        // 13. Magic Number Checks
        const newN = newA - newZ;
        const isMagicZ = MAGIC_NUMBERS.includes(newZ);
        const isMagicN = MAGIC_NUMBERS.includes(newN);

        if (isMagicZ && isMagicN) {
            scoreBonus += BONUS_SCORES.DOUBLE_MAGIC;
            messages.push(LOG_MESSAGES.UNLOCKS.DOUBLY_MAGIC(newZ, newN, BONUS_SCORES.DOUBLE_MAGIC));
        } else {
            if (isMagicZ) {
                scoreBonus += BONUS_SCORES.MAGIC_SHELL;
                messages.push(LOG_MESSAGES.UNLOCKS.MAGIC_PROTON_SHELL(newZ, BONUS_SCORES.MAGIC_SHELL));
            }
            if (isMagicN) {
                scoreBonus += BONUS_SCORES.MAGIC_SHELL;
                messages.push(LOG_MESSAGES.UNLOCKS.MAGIC_NEUTRON_SHELL(newN, BONUS_SCORES.MAGIC_SHELL));
            }
        }

        // 3. Special Hidden Title: Exp. Replicate
        // Condition: 🔮 button pressed (isTransmutation) AND result is an element already in the periodic table (isAlreadyUnlocked)
        if (isTransmutation && !isQuantumOverride && isAlreadyUnlocked && !updatedGroups.includes(TITLES.EXP_REPLICATE)) {
            updatedGroups = [...updatedGroups, TITLES.EXP_REPLICATE];
            scoreBonus += BONUS_SCORES.EXP_REPLICATE_TITLE;
            messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_EXP_REPLICATE(BONUS_SCORES.EXP_REPLICATE_TITLE));
        }
    }


    // 2. Special Hidden Title: Pair annihilation
    if (!updatedGroups.includes(TITLES.PAIR_ANNIHILATION)) {
        if (isAnnihilation) {
            updatedGroups = [...updatedGroups, TITLES.PAIR_ANNIHILATION];
            scoreBonus += BONUS_SCORES.PAIR_ANNIHILATION;
            messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_PAIR_ANNIHILATION(BONUS_SCORES.PAIR_ANNIHILATION));
        } else if (betaPlusCount >= 10) {
            updatedGroups = [...updatedGroups, TITLES.PAIR_ANNIHILATION];
            scoreBonus += BONUS_SCORES.PAIR_ANNIHILATION;
            messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_PAIR_ANNIHILATION_MASTERED(BONUS_SCORES.PAIR_ANNIHILATION));
        }
    }

    // Special Hidden Title: Neutronization
    if (!updatedGroups.includes(TITLES.NEUTRONIZATION) && betaMinusCount >= 20) {
        updatedGroups = [...updatedGroups, TITLES.NEUTRONIZATION];
        scoreBonus += BONUS_SCORES.NEUTRONIZATION;
        messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_NEUTRONIZATION(BONUS_SCORES.NEUTRONIZATION));
    }

    // 4. Special Hidden Title: Nucleosynthesis
    if (isNucleosynthesis && !updatedGroups.includes(TITLES.NUCLEOSYNTHESIS)) {
        updatedGroups = [...updatedGroups, TITLES.NUCLEOSYNTHESIS];
        scoreBonus += BONUS_SCORES.NUCLEOSYNTHESIS_TITLE;
        messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_NUCLEOSYNTHESIS(BONUS_SCORES.NUCLEOSYNTHESIS_TITLE));
    }

    // 6. Special Hidden Title: Temporal Inversion
    if (isTemporalInversion) {
        const inversionBonus = comboScore * 10;
        if (!updatedGroups.includes(TITLES.TEMPORAL_INVERSION)) {
            updatedGroups = [...updatedGroups, TITLES.TEMPORAL_INVERSION];
            messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_TEMPORAL_INVERSION(inversionBonus));
        } else {
            messages.push(LOG_MESSAGES.UNLOCKS.TEMPORAL_INVERSION_BONUS(inversionBonus));
        }
        scoreBonus += inversionBonus;
    }

    // 8. Special Hidden Title: Fusion
    if (isFusionAchieved && !updatedGroups.includes(TITLES.FUSION)) {
        updatedGroups = [...updatedGroups, TITLES.FUSION];
        scoreBonus += BONUS_SCORES.FUSION_TITLE;
        messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_FUSION(BONUS_SCORES.FUSION_TITLE));
    }

    // 9. Special Hidden Title: Fission
    if (isFissionAchieved && !updatedGroups.includes(TITLES.FISSION)) {
        updatedGroups = [...updatedGroups, TITLES.FISSION];
        scoreBonus += BONUS_SCORES.FISSION_TITLE;
        messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_FISSION(BONUS_SCORES.FISSION_TITLE));
    }

    // 10. Special Hidden Title: zero barn
    if (isZeroBarnAchieved && !updatedGroups.includes(TITLES.ZERO_BARN)) {
        updatedGroups = [...updatedGroups, TITLES.ZERO_BARN];
        scoreBonus += BONUS_SCORES.ZERO_BARN;
        messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_ZERO_BARN(BONUS_SCORES.ZERO_BARN));
    }

    // 11. Special Hidden Title: Electron scattering
    if (isBremsAchieved && !updatedGroups.includes(TITLES.ELECTRON_SCATTERING)) {
        updatedGroups = [...updatedGroups, TITLES.ELECTRON_SCATTERING];
        scoreBonus += BONUS_SCORES.ELECTRON_SCATTERING;
        messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_ELECTRON_SCATTERING(BONUS_SCORES.ELECTRON_SCATTERING));
    }

    // NEW: Special Hidden Title: Gluttony
    if (isGluttonyAchieved && !updatedGroups.includes(TITLES.GLUTTONY)) {
        updatedGroups = [...updatedGroups, TITLES.GLUTTONY];
        scoreBonus += BONUS_SCORES.GLUTTONY;
        messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_GLUTTONY(BONUS_SCORES.GLUTTONY));
    }

    // NEW: Special Hidden Title: Demon core
    if (isDaredevilAchieved && !updatedGroups.includes(TITLES.DEMON_CORE)) {
        updatedGroups = [...updatedGroups, TITLES.DEMON_CORE];
        scoreBonus += BONUS_SCORES.DEMON_CORE;
        messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_DEMON_CORE(BONUS_SCORES.DEMON_CORE));
    }

    // NEW: Special Hidden Title: Forbidden Capture
    if (isPositronAbsorbed && !updatedGroups.includes(TITLES.FORBIDDEN_CAPTURE)) {
        updatedGroups = [...updatedGroups, TITLES.FORBIDDEN_CAPTURE];
        scoreBonus += BONUS_SCORES.FORBIDDEN_CAPTURE;
        messages.push(LOG_MESSAGES.UNLOCKS.HIDDEN_TITLE_FORBIDDEN_CAPTURE(BONUS_SCORES.FORBIDDEN_CAPTURE));
    }

    return { updatedElements, updatedGroups, scoreBonus, messages };
};