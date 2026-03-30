import { GameState, NuclideData, Language } from '../types';
import { TutorialEvent } from '../types/engine/tutorial';
import { getLogMessages } from '../constants';

import { TITLES } from '../constants/titles';

const SPECIALIZED_SKILLS: string[] = [
    TITLES.PAIR_ANNIHILATION,
    TITLES.NEUTRONIZATION,
    TITLES.EXP_REPLICATE,
    TITLES.NUCLEOSYNTHESIS,
    TITLES.TEMPORAL_INVERSION,
    TITLES.FUSION,
    TITLES.FISSION,
    TITLES.ZERO_BARN,
    TITLES.ELECTRON_SCATTERING,
    TITLES.GLUTTONY,
    TITLES.DEMON_CORE,
    TITLES.REAL_PHYSICS
];

interface TutorialContext {
    randomStart?: boolean;
    nextNuclide?: NuclideData;
    currentTurn?: number;
    energyIncreased?: boolean;
}

/**
 * Pure function to determine the next tutorial message based on current state and events.
 * Priority order: 
 * 1. DRIP_LINE (Critical Danger)
 * 2. DECAY (Physical stability requirement)
 * 3. RECORD_HISTORY (E-point usage)
 * 4. CAPTURE (Default goal)
 */
export const getNextTutorialMessage = (
    state: GameState,
    event: TutorialEvent,
    context: TutorialContext = {},
    language: Language = 'en'
): string | null => {
    const logMessages = getLogMessages(language);
    const { 
        tutorialMessage: currentMsg, 
        hasSeenDecayTutorial, 
        hasSeenCaptureTutorial,
        hasSeenDripLineTutorial,
        hasSeenEngraveTutorial,
        hasSeenSkillToggleTutorial,
        tutorialStartTurn,
        energyPoints
    } = state;

    const currentTurn = context.currentTurn ?? state.turn;
    const nextNuclide = context.nextNuclide;

    // --- SPECIAL: Og-294 Congrats Persistence ---
    if (currentMsg === logMessages.TUTORIAL.OGANESSON_CONGRATS) {
        const isSameNuclide = nextNuclide && 
                             nextNuclide.z === state.currentNuclide.z && 
                             nextNuclide.a === state.currentNuclide.a;
        if (isSameNuclide || !nextNuclide) {
            return logMessages.TUTORIAL.OGANESSON_CONGRATS;
        }
    }

    // --- PRIORITY 1: Drip Line Danger ---
    const isAtDripLine = nextNuclide && !nextNuclide.isStable && (nextNuclide.isProtonDripLine || nextNuclide.isNeutronDripLine);
    if (isAtDripLine && !hasSeenDripLineTutorial) {
        return logMessages.TUTORIAL.DRIP_LINE;
    }

    // --- PRIORITY 2: Decay Requirement ---
    const shouldShowDecayNow = nextNuclide && !nextNuclide.isStable && !hasSeenDecayTutorial;
    if (shouldShowDecayNow) {
        return logMessages.TUTORIAL.DECAY;
    }

    // --- PRIORITY 3: Physics Scattering Message Persistence ---
    // These messages start with "✅" and should disappear after 3 turns
    if (currentMsg?.startsWith('✅')) {
        const elapsed = currentTurn - tutorialStartTurn;
        if (elapsed < 3) {
            return currentMsg;
        }
        // If timed out, we fall through to lower priorities
    }

    // --- PRIORITY 4: Record History (Feature Discovery) ---
    const canShowEngrave = (energyPoints >= 1) && !hasSeenEngraveTutorial;
    
    // Check timeout for Engrave message: Hide after 10 turns
    const isEngraveTimedOut = currentMsg === logMessages.TUTORIAL.RECORD_HISTORY && 
                             (currentTurn - tutorialStartTurn >= 10);
    
    const showEngraveNow = canShowEngrave && !isEngraveTimedOut;

    // --- PRIORITY 5: Skill Toggle (Feature Discovery) ---
    const hasAnySpecializedSkill = state.unlockedGroups.some(group => SPECIALIZED_SKILLS.includes(group));
    const canShowSkillToggle = hasAnySpecializedSkill && !hasSeenSkillToggleTutorial;
    const isSkillToggleTimedOut = currentMsg === logMessages.TUTORIAL.SKILL_TOGGLE && 
                                 (currentTurn - tutorialStartTurn >= 20);
    const showSkillToggleNow = canShowSkillToggle && !isSkillToggleTimedOut;

    // Special Trigger: If energy increased, re-show the recording hint if not already done
    if (context.energyIncreased && showEngraveNow && !shouldShowDecayNow && !isAtDripLine) {
        return logMessages.TUTORIAL.RECORD_HISTORY;
    }

    switch (event) {
        case 'GAME_START':
            if (context.randomStart && hasSeenCaptureTutorial) {
                if (showSkillToggleNow) return logMessages.TUTORIAL.SKILL_TOGGLE;
                return showEngraveNow ? logMessages.TUTORIAL.RECORD_HISTORY : null;
            }
            return logMessages.TUTORIAL.CAPTURE;

        case 'PARTICLE_CAPTURED':
            if (nextNuclide?.isStable) {
                if (showSkillToggleNow) return logMessages.TUTORIAL.SKILL_TOGGLE;
                return showEngraveNow ? logMessages.TUTORIAL.RECORD_HISTORY : null;
            }
            return currentMsg;

        case 'DECAY_PERFORMED':
            if (showSkillToggleNow) return logMessages.TUTORIAL.SKILL_TOGGLE;
            return showEngraveNow ? logMessages.TUTORIAL.RECORD_HISTORY : null;

        case 'ENGRAVE_PERFORMED':
            return showSkillToggleNow ? logMessages.TUTORIAL.SKILL_TOGGLE : null;

        case 'MASTERY_OPENED':
            return null;

        case 'TURN_ADVANCED':
            // Decay nudge logic
            if (currentMsg === logMessages.TUTORIAL.DECAY) {
                const elapsed = currentTurn - tutorialStartTurn;
                if (elapsed >= 50) {
                    return logMessages.TUTORIAL.DECAY_MANUAL;
                }
            }
            
            // If we were showing a scattering message and it just timed out (handled by priority check above)
            // or if we are just moving around, check for discovery tutorials
            if (showSkillToggleNow) return logMessages.TUTORIAL.SKILL_TOGGLE;
            if (showEngraveNow) return logMessages.TUTORIAL.RECORD_HISTORY;

            // Engrave message display timeout logic:
            // If shown for 10 turns without action, hide permanently (判定をtrueにする)
            if (isEngraveTimedOut) {
                return null;
            }
            
            return currentMsg;

        default:
            // Final check to ensure we respect timeout in all events
            if (currentMsg === logMessages.TUTORIAL.RECORD_HISTORY && isEngraveTimedOut) {
                return null;
            }
            return currentMsg;
    }
};

/**
 * Helper to determine state updates based on a message transition.
 */
export const calculateTutorialFlagUpdates = (
    state: GameState,
    nextMsg: string | null,
    currentTurn: number,
    event: TutorialEvent
): Partial<GameState> => {
    const logMessages = getLogMessages(state.language);
    const updates: Partial<GameState> = {};
    const currentMsg = state.tutorialMessage;

    if (currentMsg !== nextMsg) {
        updates.tutorialStartTurn = currentTurn;
    }
    
    // Capture tutorial is mastered if it was showing and is now gone or changed to decay
    if (currentMsg === logMessages.TUTORIAL.CAPTURE && nextMsg !== logMessages.TUTORIAL.CAPTURE) {
        updates.hasSeenCaptureTutorial = true;
    }
    
    // Decay tutorial is ONLY considered "seen/mastered" if the user actually performed a decay.
    if (event === 'DECAY_PERFORMED') {
        if (currentMsg === logMessages.TUTORIAL.DECAY || currentMsg === logMessages.TUTORIAL.DECAY_MANUAL) {
            updates.hasSeenDecayTutorial = true;
        }
    }

    if (event === 'MASTERY_OPENED') {
        updates.hasSeenSkillToggleTutorial = true;
    }

    // Drip Line Tutorial is mastered once the player successfully transforms into another nuclide
    if (currentMsg === logMessages.TUTORIAL.DRIP_LINE && nextMsg !== logMessages.TUTORIAL.DRIP_LINE) {
        updates.hasSeenDripLineTutorial = true;
    }

    // Engrave Tutorial is mastered if user performs the action OR if it was shown and then timed out (10 turns)
    if (event === 'ENGRAVE_PERFORMED') {
        updates.hasSeenEngraveTutorial = true;
    } else if (currentMsg === logMessages.TUTORIAL.RECORD_HISTORY) {
        const elapsed = currentTurn - state.tutorialStartTurn;
        if (elapsed >= 10) {
            updates.hasSeenEngraveTutorial = true;
        }
    }

    // Skill Toggle Tutorial is mastered if user opens mastery OR if it was shown and then timed out (20 turns)
    if (currentMsg === logMessages.TUTORIAL.SKILL_TOGGLE) {
        const elapsed = currentTurn - state.tutorialStartTurn;
        if (elapsed >= 20) {
            updates.hasSeenSkillToggleTutorial = true;
        }
    }
    
    return updates;
};