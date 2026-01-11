import { GameState, NuclideData } from '../types';
import { TUTORIAL_MESSAGES, TutorialEvent } from '../constants/tutorial';

interface TutorialContext {
    randomStart?: boolean;
    nextNuclide?: NuclideData;
    currentTurn?: number;
}

/**
 * Pure function to determine the next tutorial message based on current state and events.
 * Encapsulates the logic for transitioning between educational steps.
 * 
 * @param state Current GameState containing flags and timing.
 * @param event The interaction that just occurred.
 * @param context Additional metadata like the resulting nuclide or start conditions.
 * @returns The next message to display (string) or null if no tutorial is active.
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
        tutorialStartTurn
    } = state;

    const currentTurn = context.currentTurn ?? state.turn;

    switch (event) {
        case 'GAME_START':
            if (context.randomStart && hasSeenCaptureTutorial) {
                return null;
            }
            return TUTORIAL_MESSAGES.CAPTURE;

        case 'PARTICLE_CAPTURED':
            // Step 1 Completion: Clear capture message if it was shown
            if (currentMsg === TUTORIAL_MESSAGES.CAPTURE) {
                if (context.nextNuclide && !context.nextNuclide.isStable && !hasSeenDecayTutorial) {
                    return TUTORIAL_MESSAGES.DECAY;
                }
                return null;
            }
            
            // Step 2 Trigger: If capture results in instability and player is a novice
            if (context.nextNuclide && !context.nextNuclide.isStable && !hasSeenDecayTutorial) {
                return TUTORIAL_MESSAGES.DECAY;
            }
            
            return currentMsg;

        case 'TURN_ADVANCED':
            // Step 2 Escalation: If player stays unstable for 50 turns, show manual controls
            if (currentMsg === TUTORIAL_MESSAGES.DECAY) {
                const elapsed = currentTurn - tutorialStartTurn;
                if (elapsed >= 50) {
                    return TUTORIAL_MESSAGES.DECAY_MANUAL;
                }
            }
            return currentMsg;

        case 'DECAY_PERFORMED':
            // Step 2 Completion: Clear any decay-related guidance
            if (currentMsg === TUTORIAL_MESSAGES.DECAY || currentMsg === TUTORIAL_MESSAGES.DECAY_MANUAL) {
                return null;
            }
            return currentMsg;

        default:
            return currentMsg;
    }
};

/**
 * Helper to determine state updates based on a message transition.
 * Updates seen-flags and records the turn when a new message appears.
 */
export const calculateTutorialFlagUpdates = (
    state: GameState,
    nextMsg: string | null,
    currentTurn: number
): Partial<GameState> => {
    const updates: Partial<GameState> = {};
    const currentMsg = state.tutorialMessage;

    // Record the turn if the message changes (for threshold tracking)
    if (currentMsg !== nextMsg) {
        updates.tutorialStartTurn = currentTurn;
    }
    
    // If we moved away from the Capture message, it's considered "seen"
    if (currentMsg === TUTORIAL_MESSAGES.CAPTURE && nextMsg !== TUTORIAL_MESSAGES.CAPTURE) {
        updates.hasSeenCaptureTutorial = true;
    }
    
    // If we moved away from the initial Decay message (not to the manual one), it's considered "seen"
    if (currentMsg === TUTORIAL_MESSAGES.DECAY && nextMsg !== TUTORIAL_MESSAGES.DECAY && nextMsg !== TUTORIAL_MESSAGES.DECAY_MANUAL) {
        updates.hasSeenDecayTutorial = true;
    }

    // If the manual instructions were shown and then cleared, Step 2 is definitely completed
    if (currentMsg === TUTORIAL_MESSAGES.DECAY_MANUAL && nextMsg === null) {
        updates.hasSeenDecayTutorial = true;
    }
    
    return updates;
};
