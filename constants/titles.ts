/**
 * Centralized title and skill name constants for the Nucleus system.
 * Used to avoid magic strings across serialization, UI, and logic.
 */
export const TITLES = {
    // Element Groups
    NON_METAL: "Non-metal",
    NOBLE_GAS: "Noble Gas",
    ALKALI_METAL: "Alkali Metal",
    ALKALINE_EARTH: "Alkaline Earth",
    METALLOID: "Metalloid",
    HALOGEN: "Halogen",
    TRANSITION: "Transition",
    POST_TRANSITION: "Post-Transition",
    LANTHANIDE: "Lanthanide",
    ACTINIDE: "Actinide",

    // Specialized Skills / Hidden Titles
    PAIR_ANNIHILATION: "Pair annihilation",
    NEUTRONIZATION: "Neutronization",
    EXP_REPLICATE: "Exp. Replicate", // 英語発音は Experimental Replicate にすること
    NUCLEOSYNTHESIS: "Nucleosynthesis",
    UNKNOWN: "Unknown",
    TEMPORAL_INVERSION: "Temporal Inversion",
    FUSION: "Fusion",
    FISSION: "Fission",
    ZERO_BARN: "zero barn",
    ELECTRON_SCATTERING: "Electron scattering",
    GLUTTONY: "Gluttony",
    DEMON_CORE: "Demon core",
    FORBIDDEN_CAPTURE: "Forbidden Capture",
    RESEARCH_MISCONDUCT: "Research Misconduct",
    REAL_PHYSICS: "Real Physics",

    // Skills
    STABILIZE: "Stabilize",
    AUTO_STABILIZATION: "Auto-stabilization",
    TRANSMUTATION: "Transmutation",
    R_PROCESS: "r-process nucleosynthesis",
    QUANTUM_OVERRIDE: "Quantum Override",
    RHYTHMIC_RESONANCE: "Rhythmic Resonance"
} as const;

export type TitleName = typeof TITLES[keyof typeof TITLES];