import { TITLES } from './titles';

export const KNOWN_Z_LIMIT = 118;

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
  "Antimony", "Tellurium", "Iodine", "Xenon", "Caesium", "Barium", "Lanthanum", "Cerium", "Praseodymium", "Neodymium",
  "Promethium", "Samarium", "Europium", "Gadolinium", "Terbium", "Dysprosium", "Holmium", "Erbium", "Thulium", "Ytterbium",
  "Lutetium", "Hafnium", "Tantalum", "Tungsten", "Rhenium", "Osmium", "Iridium", "Platinum", "Gold", "Mercury",
  "Thallium", "Lead", "Bismuth", "Polonium", "Astatine", "Radon", "Francium", "Radium", "Actinium", "Thorium",
  "Protactinium", "Uranium", "Neptunium", "Plutonium", "Americium", "Curium", "Berkelium", "Californium", "Einsteinium", "Fermium",
  "Mendelevium", "Nobelium", "Lawrencium", "Rutherfordium", "Dubnium", "Seaborgium", "Bohrium", "Hassium", "Meitnerium", "Darmstadtium",
  "Roentgenium", "Copernicium", "Nihonium", "Flerovium", "Moscovium", "Livermorium", "Tennessine", "Oganesson"
];

export const ELEMENT_GROUPS: Record<string, number[]> = {
    [TITLES.NON_METAL]: [1, 6, 7, 8, 15, 16, 34],
    [TITLES.NOBLE_GAS]: [2, 10, 18, 36, 54, 86, 118],
    [TITLES.ALKALI_METAL]: [3, 11, 19, 37, 55, 87],
    [TITLES.ALKALINE_EARTH]: [4, 12, 20, 38, 56, 88],
    [TITLES.METALLOID]: [5, 14, 32, 33, 51, 52],
    [TITLES.HALOGEN]: [9, 17, 35, 53, 85, 117],
    [TITLES.TRANSITION]: [
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
        39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
        72, 73, 74, 75, 76, 77, 78, 79, 80,
        104, 105, 106, 107, 108, 109, 110, 111, 112
    ],
    [TITLES.POST_TRANSITION]: [13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116],
    [TITLES.LANTHANIDE]: Array.from({length: 15}, (_, i) => 57 + i), // 57-71
    [TITLES.ACTINIDE]: Array.from({length: 15}, (_, i) => 89 + i)    // 89-103
};

export const getSymbol = (z: number): string => {
  if (z === -1) return "e-";
  if (z === 0) return "n";
  if (z > 0 && z < ELEMENT_SYMBOLS.length) return ELEMENT_SYMBOLS[z];
  return `E${z}`;
};

export const getName = (z: number): string => {
  if (z === -1) return "Electron";
  if (z === 0) return "Neutron";
  if (z > 0 && z < ELEMENT_NAMES.length) return ELEMENT_NAMES[z];
  return `Element-${z}`;
};