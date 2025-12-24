
import { ELEMENT_GROUPS, MAGIC_NUMBERS } from '../constants';

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
    isZeroBarnAchieved: boolean = false
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
            messages.push(` 👑 HIDDEN TITLE: Neutron (n)! (+${trophyBonus} PTS)`);
        } else {
            trophyBonus = newZ * 1000;
            messages.push(` 🏆 NEW TITLE: Z=${newZ}! (+${trophyBonus} PTS)`);
        }
        scoreBonus += trophyBonus;
    }

    // 2. Special Hidden Title: Pair anihilation
    if (isAnnihilation && !updatedGroups.includes("Pair anihilation")) {
        updatedGroups = [...updatedGroups, "Pair anihilation"];
        scoreBonus += 20000;
        messages.push(` 👑 HIDDEN TITLE: Pair anihilation! (+20,000 PTS)`);
    }

    // 3. Special Hidden Title: Replication (formerly Transmutation / Experimental Replication)
    if (isTransmutation && !updatedGroups.includes("Replication")) {
        updatedGroups = [...updatedGroups, "Replication"];
        scoreBonus += 30000;
        messages.push(` 👑 HIDDEN TITLE: Replication! (+30,000 PTS)`);
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
        messages.push(` 🌟 HIDDEN TITLE: Tetraneutron! The Void State. (+400,000 PTS)`);
    }

    // 6. Special Hidden Title: Temporal Inversion (TENET)
    if (isTemporalInversion) {
        const inversionBonus = comboScore * 10;
        if (!updatedGroups.includes("Temporal Inversion")) {
            updatedGroups = [...updatedGroups, "Temporal Inversion"];
            messages.push(` ✨ HIDDEN TITLE: Temporal Inversion. (+${inversionBonus.toLocaleString()} PTS 10x Bonus!)`);
        } else {
            messages.push(` ✨ TEMPORAL INVERSION: 10x Combo Score! (+${inversionBonus.toLocaleString()} PTS)`);
        }
        scoreBonus += inversionBonus;
    }

    // 7. Special Hidden Title: Coulomb barrier
    if (isCoulombScattered && !updatedGroups.includes("Coulomb barrier")) {
        updatedGroups = [...updatedGroups, "Coulomb barrier"];
        scoreBonus += 10000;
        messages.push(` 👑 HIDDEN TITLE: Coulomb barrier! (+10,000 PTS)`);
    }

    // 8. Special Hidden Title: Fusion (Unlock by p+p reaction)
    if (isFusionAchieved && !updatedGroups.includes("Fusion")) {
        updatedGroups = [...updatedGroups, "Fusion"];
        scoreBonus += 42000;
        messages.push(` 👑 HIDDEN TITLE: Fusion! (+42,000 PTS)`);
    }

    // 9. Special Hidden Title: Fission (Unlock by n-induced fission)
    if (isFissionAchieved && !updatedGroups.includes("Fission")) {
        updatedGroups = [...updatedGroups, "Fission"];
        scoreBonus += 2000000;
        messages.push(` ☢️ HIDDEN TITLE: Fission! Breaking the Nucleus. (+2,000,000 PTS)`);
    }

    // 10. Special Hidden Title: zero barn (Unlock by 20 consecutive neutrons)
    if (isZeroBarnAchieved && !updatedGroups.includes("zero barn")) {
        updatedGroups = [...updatedGroups, "zero barn"];
        scoreBonus += 500000;
        messages.push(` 🌑 HIDDEN TITLE: zero barn! Neutrons flow through you. (+500,000 PTS)`);
    }

    // 11. Group Unlock Check
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

    // 12. Magic Number Checks (Physics Bonus)
    const newN = newA - newZ;
    const isMagicZ = MAGIC_NUMBERS.includes(newZ);
    const isMagicN = MAGIC_NUMBERS.includes(newN);

    if (isMagicZ && isMagicN) {
        scoreBonus += 50000;
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
