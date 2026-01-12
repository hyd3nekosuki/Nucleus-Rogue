
import { GameState, NuclideData } from '../types';
import { TUTORIAL_MESSAGES, TutorialEvent } from '../constants/tutorial';

interface TutorialContext {
    randomStart?: boolean;
    nextNuclide?: NuclideData;
    currentTurn?: number;
}

/**
 * Pure function to determine the next tutorial message based on current state and events.
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
        tutorialStartTurn
    } = state;

    const currentTurn = context.currentTurn ?? state.turn;
    const nextNuclide = context.nextNuclide;

    // Condition for Drip Line Tutorial: 
    // Is at Drip Line limit AND has not mastered this critical phase.
    const isAtDripLine = nextNuclide && !nextNuclide.isStable && (nextNuclide.isProtonDripLine || nextNuclide.isNeutronDripLine);
    if (isAtDripLine && !hasSeenDripLineTutorial) {
        return TUTORIAL_MESSAGES.DRIP_LINE;
    }

    // Check if the resulting state is radioactive (unstable) for the first time
    const shouldShowDecayNow = nextNuclide && !nextNuclide.isStable && !hasSeenDecayTutorial;

    switch (event) {
        case 'GAME_START':
            if (shouldShowDecayNow) {
                return TUTORIAL_MESSAGES.DECAY;
            }
            if (context.randomStart && hasSeenCaptureTutorial) {
                return null;
            }
            return TUTORIAL_MESSAGES.CAPTURE;

        case 'PARTICLE_CAPTURED':
            if (shouldShowDecayNow) {
                return TUTORIAL_MESSAGES.DECAY;
            }
            // If the nucleus becomes stable via capture, clear any tutorial message 
            // (either CAPTURE or DECAY), but notably we don't set the "seen" flag yet 
            // for decay unless they actually perform the decay action.
            if (nextNuclide?.isStable) {
                return null;
            }
            return currentMsg;

        case 'DECAY_PERFORMED':
            // Performing a decay manually implies mastery of the mechanic.
            // Clear the guidance regardless of whether the daughter is unstable.
            return null;

        case 'TURN_ADVANCED':
            if (currentMsg === TUTORIAL_MESSAGES.DECAY) {
                const elapsed = currentTurn - tutorialStartTurn;
                if (elapsed >= 50) {
                    return TUTORIAL_MESSAGES.DECAY_MANUAL;
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
    // and the message is cleared.
    if (currentMsg === TUTORIAL_MESSAGES.DRIP_LINE && nextMsg !== TUTORIAL_MESSAGES.DRIP_LINE) {
        updates.hasSeenDripLineTutorial = true;
    }
    
    return updates;
};
