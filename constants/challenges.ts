/**
 * Challenge Metadata for Nucleus Rogue
 * Poetic hints for achievements without explicit spoilers.
 */
export interface ChallengeMetadata {
    id: string;
    title: string;
    hint: string;
}

export const CHALLENGES: ChallengeMetadata[] = [
    { 
        id: 'reincarnated', 
        title: 'Reincarnation', 
        hint: 'A soul reborn in the cosmic fire.' 
    },
    { 
        id: 'combo_master', 
        title: 'Combo Master', 
        hint: 'Rhythm found in the heart of chaos.' 
    },
    { 
        id: 'i_am_the_alpha', 
        title: 'I am the Alpha', 
        hint: "The Alpha's dance, in every sacred form." 
    },
    { 
        id: 'beta_master', 
        title: 'Master of Beta', 
        hint: 'A ghost seen in every mirror.' 
    },
    { 
        id: 'seasoned_nuclide', 
        title: 'Seasoned Nuclide', 
        hint: 'Every whisper of the core has been heard.' 
    },
    { 
        id: 'oganesson', 
        title: 'FAR BEYOND BOUNDARY', 
        hint: 'The horizon fades into the infinite.' 
    },
    { 
        id: 'forbidden_capture', 
        title: 'Forbidden Capture', 
        hint: "A phantom's touch, light and shadow merge." 
    },
    { 
        id: 'all_elements', 
        title: 'Periodic Table Complete', 
        hint: 'A complete song of all that is.' 
    },
    { 
        id: 'this_is_it', 
        title: 'This is IT', 
        hint: "A quiet shift in the heart of the atom." 
    },
];
