
import { GameState, NuclideData } from '../types';
import { TUTORIAL_MESSAGES, TutorialEvent } from '../constants/tutorial';

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
    context: TutorialContext = {}
): string | null => {
    const { 
        tutorialMessage: currentMsg, 
        hasSeenDecayTutorial, 
        hasSeenCaptureTutorial,
        hasSeenDripLineTutorial,
        hasSeenEngraveTutorial,
        tutorialStartTurn,
        energyPoints
    } = state;

    const currentTurn = context.currentTurn ?? state.turn;
    const nextNuclide = context.nextNuclide;

    // --- PRIORITY 1: Drip Line Danger ---
    const isAtDripLine = nextNuclide && !nextNuclide.isStable && (nextNuclide.isProtonDripLine || nextNuclide.isNeutronDripLine);
    if (isAtDripLine && !hasSeenDripLineTutorial) {
        return TUTORIAL_MESSAGES.DRIP_LINE;
    }

    // --- PRIORITY 2: Decay Requirement ---
    const shouldShowDecayNow = nextNuclide && !nextNuclide.isStable && !hasSeenDecayTutorial;
    if (shouldShowDecayNow) {
        return TUTORIAL_MESSAGES.DECAY;
    }

    // --- PRIORITY 3: Record History (Feature Discovery) ---
    const canShowEngrave = (energyPoints >= 1) && !hasSeenEngraveTutorial;

    // Special Trigger: If energy increased, re-show the recording hint if not already done
    if (context.energyIncreased && canShowEngrave && !shouldShowDecayNow && !isAtDripLine) {
        return TUTORIAL_MESSAGES.RECORD_HISTORY;
    }

    switch (event) {
        case 'GAME_START':
            if (context.randomStart && hasSeenCaptureTutorial) {
                return canShowEngrave ? TUTORIAL_MESSAGES.RECORD_HISTORY : null;
            }
            return TUTORIAL_MESSAGES.CAPTURE;

        case 'PARTICLE_CAPTURED':
            if (nextNuclide?.isStable) {
                return canShowEngrave ? TUTORIAL_MESSAGES.RECORD_HISTORY : null;
            }
            return currentMsg;

        case 'DECAY_PERFORMED':
            return canShowEngrave ? TUTORIAL_MESSAGES.RECORD_HISTORY : null;

        case 'ENGRAVE_PERFORMED':
            return null;

        case 'TURN_ADVANCED':
            // Decay nudge logic
            if (currentMsg === TUTORIAL_MESSAGES.DECAY) {
                const elapsed = currentTurn - tutorialStartTurn;
                if (elapsed >= 50) {
                    return TUTORIAL_MESSAGES.DECAY_MANUAL;
                }
            }
            
            // Engrave message display timeout logic:
            // If shown for 10 turns without action, hide it temporarily.
            if (currentMsg === TUTORIAL_MESSAGES.RECORD_HISTORY) {
                const elapsed = currentTurn - tutorialStartTurn;
                if (elapsed >= 10) {
                    return null;
                }
            }
            
            return currentMsg;

        default:
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
    const updates: Partial<GameState> = {};
    const currentMsg = state.tutorialMessage;

    if (currentMsg !== nextMsg) {
        updates.tutorialStartTurn = currentTurn;
    }
    
    // Capture tutorial is mastered if it was showing and is now gone or changed to decay
    if (currentMsg === TUTORIAL_MESSAGES.CAPTURE && nextMsg !== TUTORIAL_MESSAGES.CAPTURE) {
        updates.hasSeenCaptureTutorial = true;
    }
    
    // Decay tutorial is ONLY considered "seen/mastered" if the user actually performed a decay.
    if (event === 'DECAY_PERFORMED') {
        if (currentMsg === TUTORIAL_MESSAGES.DECAY || currentMsg === TUTORIAL_MESSAGES.DECAY_MANUAL) {
            updates.hasSeenDecayTutorial = true;
        }
    }

    // Drip Line Tutorial is mastered once the player successfully transforms into another nuclide
    if (currentMsg === TUTORIAL_MESSAGES.DRIP_LINE && nextMsg !== TUTORIAL_MESSAGES.DRIP_LINE) {
        updates.hasSeenDripLineTutorial = true;
    }

    // Engrave Tutorial is mastered if user performs the action
    if (event === 'ENGRAVE_PERFORMED') {
        updates.hasSeenEngraveTutorial = true;
    }
    
    return updates;
};
