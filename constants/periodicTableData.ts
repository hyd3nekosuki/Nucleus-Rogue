
/**
 * Static metadata for Periodic Table visualization and Skills.
 * Extracted from PeriodicTable.tsx to improve maintainability.
 */

export const ELEMENT_CATEGORIES: Record<string, { name: string, class: string }> = {
    SPECIAL: { name: "Special", class: "bg-gray-100 border-white text-gray-900 shadow-[0_0_15px_white] z-10 scale-110 font-bold" },
    NOBLE_GAS: { name: "Noble Gas", class: "bg-purple-900/40 border-purple-500/50 text-purple-300" },
    ALKALI_METAL: { name: "Alkali Metal", class: "bg-rose-900/40 border-rose-500/50 text-rose-300" },
    ALKALINE_EARTH: { name: "Alkaline Earth", class: "bg-orange-900/40 border-orange-500/50 text-orange-300" },
    LANTHANIDE: { name: "Lanthanide", class: "bg-pink-900/40 border-pink-500/50 text-pink-300" },
    ACTINIDE: { name: "Actinide", class: "bg-fuchsia-900/40 border-fuchsia-500/50 text-fuchsia-300" },
    HALOGEN: { name: "Halogen", class: "bg-indigo-900/40 border-indigo-500/50 text-indigo-300" },
    METALLOID: { name: "Metalloid", class: "bg-teal-900/40 border-teal-500/50 text-teal-300" },
    NON_METAL: { name: "Non-metal", class: "bg-blue-900/40 border-blue-500/50 text-blue-300" },
    POST_TRANSITION: { name: "Post-Transition", class: "bg-emerald-900/40 border-emerald-500/50 text-emerald-300" },
    TRANSITION: { name: "Transition", class: "bg-yellow-900/40 border-yellow-500/50 text-yellow-300" },
    OTHER: { name: "Other", class: "bg-gray-900 border-gray-500 text-gray-300" }
};

export const SKILL_METADATA = [
    { name: "Neutronization", icon: "⚪", class: "bg-white/10 border-gray-300 text-white font-bold shadow-[0_0_10px_white]" },
    { name: "Pair annihilation", icon: "☯", class: "bg-blue-500/20 border-neon-blue text-neon-blue font-bold shadow-[0_0_10px_#00f3ff]" },
    { name: "Fission", icon: "☢️", class: "bg-red-600/20 border-red-500 text-red-400 font-bold shadow-[0_0_10px_#ef4444]" },
    { name: "Fusion", icon: "💥", class: "bg-orange-600/20 border-orange-500 text-orange-400 font-bold shadow-[0_0_10px_#f97316]" },
    { name: "zero barn", icon: "🌑", class: "bg-gray-800 border-gray-400 text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.4)]" },
    { name: "Electron scattering", icon: "↪️", class: "bg-yellow-600/20 border-yellow-400 text-yellow-300 font-bold shadow-[0_0_10px_#facc15]" },
    { name: "Exp. Replicate", icon: "⚛️", class: "bg-neon-purple/20 border-neon-purple text-neon-purple font-bold shadow-[0_0_10px_#bc13fe]" },
    { name: "Nucleosynthesis", icon: "🌟", class: "bg-blue-600/20 border-neon-blue text-white font-black shadow-[0_0_15px_#00f3ff]" },
    { name: "Temporal Inversion", icon: "⏱", class: "bg-white/10 border-white text-white font-black shadow-[0_0_15px_white]" },
    { name: "Unknown", icon: "❔", class: "bg-black border-purple-500 text-purple-300 shadow-[0_0_10px_#a855f7] font-black" },
    { name: "Gluttony", icon: "🕳️", class: "bg-indigo-900/40 border-indigo-500 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.5)] font-black" },
    { name: "Daredevil", icon: "🧨", class: "bg-red-900 border-orange-500 text-white shadow-[0_0_15px_rgba(255,0,0,0.6)] font-black" }
];
