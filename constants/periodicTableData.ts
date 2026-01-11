import { TITLES } from './titles';

/**
 * Static metadata for Periodic Table visualization and Skills.
 * Extracted from PeriodicTable.tsx to improve maintainability.
 */

export const ELEMENT_CATEGORIES: Record<string, { name: string, class: string }> = {
    SPECIAL: { name: "Special", class: "bg-gray-100 border-white text-gray-900 shadow-[0_0_15px_white] z-10 scale-110 font-bold" },
    [TITLES.NOBLE_GAS]: { name: TITLES.NOBLE_GAS, class: "bg-purple-900/40 border-purple-500/50 text-purple-300" },
    [TITLES.ALKALI_METAL]: { name: TITLES.ALKALI_METAL, class: "bg-rose-900/40 border-rose-500/50 text-rose-300" },
    [TITLES.ALKALINE_EARTH]: { name: TITLES.ALKALINE_EARTH, class: "bg-orange-900/40 border-orange-500/50 text-orange-300" },
    [TITLES.LANTHANIDE]: { name: TITLES.LANTHANIDE, class: "bg-pink-900/40 border-pink-500/50 text-pink-300" },
    [TITLES.ACTINIDE]: { name: TITLES.ACTINIDE, class: "bg-fuchsia-900/40 border-fuchsia-500/50 text-fuchsia-300" },
    [TITLES.HALOGEN]: { name: TITLES.HALOGEN, class: "bg-indigo-900/40 border-indigo-500/50 text-indigo-300" },
    [TITLES.METALLOID]: { name: TITLES.METALLOID, class: "bg-teal-900/40 border-teal-500/50 text-teal-300" },
    [TITLES.NON_METAL]: { name: TITLES.NON_METAL, class: "bg-blue-900/40 border-blue-500/50 text-blue-300" },
    [TITLES.POST_TRANSITION]: { name: TITLES.POST_TRANSITION, class: "bg-emerald-900/40 border-emerald-500/50 text-emerald-300" },
    [TITLES.TRANSITION]: { name: TITLES.TRANSITION, class: "bg-yellow-900/40 border-yellow-500/50 text-yellow-300" },
    OTHER: { name: "Other", class: "bg-gray-900 border-gray-500 text-gray-300" }
};

export const SKILL_METADATA = [
    { name: TITLES.NEUTRONIZATION, icon: "⚪", class: "bg-white/10 border-gray-300 text-white font-bold shadow-[0_0_10px_white]" },
    { name: TITLES.PAIR_ANNIHILATION, icon: "☯", class: "bg-blue-500/20 border-neon-blue text-neon-blue font-bold shadow-[0_0_10px_#00f3ff]" },
    { name: TITLES.FISSION, icon: "☢️", class: "bg-red-600/20 border-red-500 text-red-400 font-bold shadow-[0_0_10px_#ef4444]" },
    { name: TITLES.FUSION, icon: "💥", class: "bg-orange-600/20 border-orange-500 text-orange-400 font-bold shadow-[0_0_10px_#f97316]" },
    { name: TITLES.ZERO_BARN, icon: "🌑", class: "bg-gray-800 border-gray-400 text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.4)]" },
    { name: TITLES.ELECTRON_SCATTERING, icon: "↪️", class: "bg-yellow-600/20 border-yellow-400 text-yellow-300 font-bold shadow-[0_0_10px_#facc15]" },
    { name: TITLES.EXP_REPLICATE, icon: "⚛️", class: "bg-neon-purple/20 border-neon-purple text-neon-purple font-bold shadow-[0_0_10px_#bc13fe]" },
    { name: TITLES.NUCLEOSYNTHESIS, icon: "🌟", class: "bg-blue-600/20 border-neon-blue text-white font-black shadow-[0_0_15px_#00f3ff]" },
    { name: TITLES.TEMPORAL_INVERSION, icon: "⏱", class: "bg-white/10 border-white text-white font-black shadow-[0_0_15px_white]" },
    { name: TITLES.UNKNOWN, icon: "❔", class: "bg-black border-purple-500 text-purple-300 shadow-[0_0_10px_#a855f7] font-black" },
    { name: TITLES.GLUTTONY, icon: "🕳️", class: "bg-indigo-900/40 border-indigo-500 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.5)] font-black" },
    { name: TITLES.DAREDEVIL, icon: "🧨", class: "bg-red-900 border-orange-500 text-white shadow-[0_0_15px_rgba(255,0,0,0.6)] font-black" }
];