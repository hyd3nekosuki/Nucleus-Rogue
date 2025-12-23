
import { DecayMode, NuclideData, NuclideCategory } from './types';

export const GRID_WIDTH = 15;
export const GRID_HEIGHT = 15;
export const INITIAL_HP = 100;

export const APP_VERSION = "1.2.2";

// Fix: Added KNOWN_Z_LIMIT export to satisfy App.tsx import
export const KNOWN_Z_LIMIT = 118;

export const MAGIC_NUMBERS = [2, 8, 20, 28, 50, 82, 126];

export const INITIAL_NUCLIDE: NuclideData = {
  z: 1,
  a: 1,
  symbol: 'H',
  name: 'Hydrogen-1',
  halfLifeText: 'Stable',
  halfLifeSeconds: Infinity,
  decayModes: [DecayMode.STABLE],
  category: NuclideCategory.STABLE,
  isStable: true,
  exists: true,
  description: 'The most abundant element in the universe.'
};

export const ELEMENT_SYMBOLS = [
  "n", "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
  "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
  "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd",
  "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
  "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th", "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm",
  "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds", "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og"
];

export const ELEMENT_NAMES = [
  "Neutron", "Hydrogen", "Helium", "Lithium", "Beryllium", "Boron", "Carbon", "Nitrogen", "Oxygen", "Fluorine", "Neon",
  "Sodium", "Magnesium", "Aluminium", "Silicon", "Phosphorus", "Sulfur", "Chlorine", "Argon", "Potassium", "Calcium",
  "Scandium", "Titanium", "Vanadium", "Chromium", "Manganese", "Iron", "Cobalt", "Nickel", "Copper", "Zinc",
  "Gallium", "Germanium", "Arsenic", "Selenium", "Bromine", "Krypton", "Rubidium", "Strontium", "Yttrium", "Zirconium",
  "Niobium", "Molybdenum", "Technetium", "Ruthenium", "Rhodium", "Palladium", "Silver", "Cadmium", "Indium", "Tin",
  "Antimony", "Tellurium", "Iodine", "Xenon", "Csium", "Barium", "Lanthanum", "Cerium", "Praseodymium", "Neodymium",
  "Promethium", "Smarium", "Europium", "Gadolinium", "Terbium", "Dysprosium", "Holmium", "Erbium", "Thulium", "Ytterbium",
  "Lutetium", "Hafnium", "Tantalum", "Tungsten", "Rhenium", "Osmium", "Iridium", "Platinum", "Gold", "Mercury",
  "Thallium", "Lead", "Bismuth", "Polonium", "Astatine", "Radon", "Francium", "Radium", "Actinium", "Thorium", "Protactinium", "Uranium", "Neptunium", "Plutonium", "Americium", "Curium", "Berkelium", "Californium", "Einsteinium", "Fermium",
  "Mendelevium", "Nobelium", "Lawrencium", "Rutherfordium", "Dubnium", "Seaborgium", "Bohrium", "Hassium", "Meitnerium", "Darmstadtium", "Roentgenium", "Copernicium", "Nihonium", "Flerovium", "Moscovium", "Livermorium", "Tennessine", "Oganesson"
];

// Definition of Chemical Groups for Achievements
export const ELEMENT_GROUPS: Record<string, number[]> = {
    "Non-metal": [1, 6, 7, 8, 15, 16, 34],
    "Noble Gas": [2, 10, 18, 36, 54, 86, 118],
    "Alkali Metal": [3, 11, 19, 37, 55, 87],
    "Alkaline Earth": [4, 12, 20, 38, 56, 88],
    "Metalloid": [5, 14, 32, 33, 51, 52],
    "Halogen": [9, 17, 35, 53, 85, 117],
    "Transition": [
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
        39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
        72, 73, 74, 75, 76, 77, 78, 79, 80,
        104, 105, 106, 107, 108, 109, 110, 111, 112
    ],
    "Post-Transition": [13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116],
    "Lanthanide": Array.from({length: 15}, (_, i) => 57 + i), // 57-71
    "Actinide": Array.from({length: 15}, (_, i) => 89 + i)    // 89-103
};

// Helper to get symbol
export const getSymbol = (z: number): string => {
  if (z === 0) return "n";
  if (z < ELEMENT_SYMBOLS.length) return ELEMENT_SYMBOLS[z];
  return `E${z}`;
};

// Helper to get full name
export const getName = (z: number): string => {
  if (z === 0) return "Neutron";
  if (z < ELEMENT_NAMES.length) return ELEMENT_NAMES[z];
  return `Element-${z}`;
};
