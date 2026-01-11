/**
 * Standard tutorial messages for nuclear mastery.
 * Centralized here to ensure consistency and facilitate future localization.
 */
export const TUTORIAL_MESSAGES = {
    CAPTURE: "Capture particle to transform",
    DECAY: "Decay to be stable",
    DECAY_MANUAL: "Press Space or Click yourself to Decay"
} as const;

export type TutorialEvent = 'GAME_START' | 'PARTICLE_CAPTURED' | 'DECAY_PERFORMED' | 'TURN_ADVANCED';
