
import React from 'react';
import { REASON } from '../constants/gameOverReason';

/**
 * Visual configuration for various game ending conditions.
 */
export const REASON_METADATA: Record<string, { title: string; getDescription: (name: string) => React.ReactNode }> = {
    [REASON.FATAL_CAPTURE]: {
        title: "FATAL CAPTURE",
        getDescription: () => <>Fatal capture occurred at <span className="font-bold text-neon-red">low stability</span>.</>
    },
    [REASON.DECAY_FAILED]: {
        title: "DECAY FAILED",
        getDescription: (name) => <><span className="font-bold text-neon-blue">{name}</span> fails to decay into an existing descendant nuclide.</>
    },
    [REASON.TRANSFORMATION_FAILED]: {
        title: "TRANSFORMATION FAILED",
        getDescription: (name) => <><span className="font-bold text-neon-blue">{name}</span> fails to transform into an existing descendant nuclide.</>
    },
    [REASON.NUCLEUS_COLLAPSE]: {
        title: "NUCLEUS COLLAPSE",
        getDescription: () => <>Accretion reached an <span className="font-bold text-neon-blue">impossible configuration</span>.</>
    },
    [REASON.NOTHINGNESS]: {
        title: "TOTAL ANNIHILATION",
        getDescription: () => <>Matter and anti-nuclide collided. The nucleus was reduced to <span className="font-bold text-neon-purple animate-pulse">pure radiation</span>.</>
    },
    [REASON.UNKNOWN]: {
        title: "UNKNOWN",
        getDescription: (name) => <>You were <span className="font-bold text-neon-blue">{name}</span></>
    },
    "DEFAULT": {
        title: "RADIOACTIVE DECAY",
        getDescription: (name) => <>You were <span className="font-bold text-neon-blue">{name}</span></>
    }
};
