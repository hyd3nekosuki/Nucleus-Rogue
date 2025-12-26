
import { ELEMENT_GROUPS, MAGIC_NUMBERS } from '../constants';
import { DecayMode } from '../types';

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
    betaMinusCount: number = 0
) => {
    let updatedElements = currentUnlockedElements;
    let updatedGroups = currentUnlockedGroups;
    let scoreBonus = 0;
    let messages: string[] = [];

    // 1. Element Unlock
    if (!currentUnlockedElements.includes(newZ) && newZ >= 0) {
        updatedElements = [...currentUnlockedElements, newZ].sort((a,b) => a-b);
        
        let trophyBonus = 0;
        if (newZ === 0) {
            trophyBonus = 100000;
            messages.push(` 👑 HIDDEN TITLE: Neutron (n)! (+${trophyBonus.toLocaleString()} PTS)`);
        } else {
            trophyBonus = newZ * 1000;
            messages.push(` 🏆 NEW TITLE: Z=${newZ}! (+${trophyBonus.toLocaleString()} PTS)`);
        }
        scoreBonus += trophyBonus;
    }

    // 2. Special Hidden Title: Pair anihilation
    if (!updatedGroups.includes("Pair anihilation")) {
        if (isAnnihilation) {
            updatedGroups = [...updatedGroups, "Pair anihilation"];
            scoreBonus += 20000;
            messages.push(` ☯️ HIDDEN TITLE: Pair anihilation! (+20,000 PTS)`);
        } else if (betaPlusCount >= 10) {
            updatedGroups = [...updatedGroups, "Pair anihilation"];
            scoreBonus += 20000;
            messages.push(` ☯️ HIDDEN TITLE: Pair anihilation! (Mastered β+ Emission) (+20,000 PTS)`);
        }
    }

    // NEW: Special Hidden Title: Neutron star
    if (!updatedGroups.includes("Neutron star") && betaMinusCount >= 20) {
        updatedGroups = [...updatedGroups, "Neutron star"];
        scoreBonus += 50000;
        messages.push(` ⚪ HIDDEN TITLE: Neutron star! (Mastered p + e- → n reaction) (+50,000 PTS)`);
    }

    // 3. Special Hidden Title: Exp. Replicate
    if (isTransmutation && !updatedGroups.includes("Exp. Replicate")) {
        updatedGroups = [...updatedGroups, "Exp. Replicate"];
        scoreBonus += 30000;
        messages.push(` ⚛️ HIDDEN TITLE: Exp. Replicate! (+30,000 PTS)`);
    }

    // 4. Special Hidden Title: Nucleosynthesis
    if (isNucleosynthesis && !updatedGroups.includes("Nucleosynthesis")) {
        updatedGroups = [...updatedGroups, "Nucleosynthesis"];
        scoreBonus += 2000000;
        messages.push(` 🌟 HIDDEN TITLE: Nucleosynthesis! The Creation of Elements. (+2,000,000 PTS)`);
    }

    // 5. Special Hidden Title: Tetraneutron
    if (newZ === 0 && newA === 4 && !updatedGroups.includes("Tetraneutron")) {
        updatedGroups = [...updatedGroups, "Tetraneutron"];
        scoreBonus += 400000;
        messages.push(` 🌌 HIDDEN TITLE: Tetraneutron! The Void State. (+400,000 PTS)`);
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

    // 7. Coulomb barrier title removed as requested.

    // 8. Special Hidden Title: Fusion
    if (isFusionAchieved && !updatedGroups.includes("Fusion")) {
        updatedGroups = [...updatedGroups, "Fusion"];
        scoreBonus += 420000;
        messages.push(` 💥 HIDDEN TITLE: Fusion! (+420,000 PTS)`);
    }

    // 9. Special Hidden Title: Fission
    if (isFissionAchieved && !updatedGroups.includes("Fission")) {
        updatedGroups = [...updatedGroups, "Fission"];
        scoreBonus += 2000000;
        messages.push(` ☢️ HIDDEN TITLE: Fission! Breaking the Nucleus. (+2,000,000 PTS)`);
    }

    // 10. Special Hidden Title: zero barn
    if (isZeroBarnAchieved && !updatedGroups.includes("zero barn")) {
        updatedGroups = [...updatedGroups, "zero barn"];
        scoreBonus += 500000;
        messages.push(` 🌑 HIDDEN TITLE: zero barn! Neutrons flow through you. (+500,000 PTS)`);
    }

    // 11. Special Hidden Title: Bremsstrahlung
    if (isBremsAchieved && !updatedGroups.includes("Bremsstrahlung")) {
        updatedGroups = [...updatedGroups, "Bremsstrahlung"];
        scoreBonus += 100000;
        messages.push(` ⤵️ HIDDEN TITLE: Bremsstrahlung! Continuous electron capture at HP ≤ 10! (+100,000 PTS)`);
    }

    // 12. Group Unlock Check
    Object.entries(ELEMENT_GROUPS).forEach(([groupName, groupZs]) => {
        if (!updatedGroups.includes(groupName)) {
            const allFound = groupZs.every(z => updatedElements.includes(z));
            if (allFound) {
                updatedGroups = [...updatedGroups, groupName];
                scoreBonus += 1000000;
                messages.push(` 👑 GRANDMASTER: ${groupName} Series Completed! (+1,000,000 PTS)`);
            }
        }
    });

    // 13. Magic Number Checks
    const newN = newA - newZ;
    const isMagicZ = MAGIC_NUMBERS.includes(newZ);
    const isMagicN = MAGIC_NUMBERS.includes(newN);

    if (isMagicZ && isMagicN) {
        scoreBonus += 5000;
        messages.push(` 🧙‍♂️✨ DOUBLY MAGIC NUCLEUS! (Z=${newZ}, N=${newN}) (+50,000 PTS)`);
    } else {
        if (isMagicZ) {
            scoreBonus += 5000;
            messages.push(` ✨ MAGIC PROTON SHELL CLOSED (Z=${newZ})! (+5,000 PTS)`);
        }
        if (isMagicN) {
            scoreBonus += 5000;
            messages.push(` ✨ MAGIC NEUTRON SHELL CLOSED (N=${newN})! (+5,000 PTS)`);
        }
    }

    return { updatedElements, updatedGroups, scoreBonus, messages };
};
