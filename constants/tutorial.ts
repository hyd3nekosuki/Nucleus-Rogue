
/**
 * Standard tutorial messages for nuclear mastery.
 * Centralized here to ensure consistency and facilitate future localization.
 */
export const TUTORIAL_MESSAGES = {
    CAPTURE: "Capture particle to transform",
    DECAY: "Decay to become stable",
    DECAY_MANUAL: "Press spacebar or click nuclide to decay",
    DRIP_LINE: "Carefully and Quickly capture particle or decay"
} as const;

export type TutorialEvent = 'GAME_START' | 'PARTICLE_CAPTURED' | 'DECAY_PERFORMED' | 'TURN_ADVANCED';
