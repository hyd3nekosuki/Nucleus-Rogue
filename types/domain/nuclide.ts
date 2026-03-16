/**
 * Physical Nuclide Domain Types
 * Contains definitions related to nuclear science and database structures.
 */

export enum DecayMode {
  STABLE = 'STABLE',
  ALPHA = 'ALPHA',
  BETA_MINUS = 'BETA_MINUS',
  BETA_PLUS = 'BETA_PLUS',
  PROTON_EMISSION = 'PROTON_EMISSION',
  TWO_PROTON_EMISSION = 'TWO_PROTON_EMISSION',
  NEUTRON_EMISSION = 'NEUTRON_EMISSION',
  SPONTANEOUS_FISSION = 'SPONTANEOUS_FISSION',
  ELECTRON_CAPTURE = 'ELECTRON_CAPTURE',
  DOUBLE_ELECTRON_CAPTURE = 'DOUBLE_ELECTRON_CAPTURE',
  GAMMA = 'GAMMA',
  UNKNOWN = 'UNKNOWN',
  GAMMA_RAY_H = 'GAMMA_RAY_H',
  GAMMA_RAY_V = 'GAMMA_RAY_V',
  GAMMA_RAY_UP = 'GAMMA_RAY_UP',
  GAMMA_RAY_DOWN = 'GAMMA_RAY_DOWN',
  GAMMA_RAY_LEFT = 'GAMMA_RAY_LEFT',
  GAMMA_RAY_RIGHT = 'GAMMA_RAY_RIGHT',
  GAMMA_RAY_DIAG_TL_BR = 'GAMMA_RAY_DIAG_TL_BR',
  GAMMA_RAY_DIAG_TR_BL = 'GAMMA_RAY_DIAG_TR_BL',
  STABILIZE_ZAP = 'STABILIZE_ZAP',
  NUCLEOSYNTHESIS_ZAP = 'NUCLEOSYNTHESIS_ZAP',
  TWO_NEUTRON_EMISSION = 'TWO_NEUTRON_EMISSION',
  DOUBLE_BETA_MINUS = 'DOUBLE_BETA_MINUS',
  DOUBLE_BETA_PLUS = 'DOUBLE_BETA_PLUS',
  IT = 'IT',
  B_MINUS_N = 'B-N',
  B_MINUS_2N = 'B-2N',
  B_MINUS_3N = 'B-3N',
  B_MINUS_4N = 'B-4N',
  B_MINUS_5N = 'B-5N',
  B_MINUS_6N = 'B-6N',
  B_MINUS_7N = 'B-7N',
  B_MINUS_ALPHA = 'B-A',
  B_MINUS_PROTON = 'B-P',
  B_MINUS_SF = 'B-SF',
  B_PLUS_ALPHA = 'B+A',
  B_PLUS_PROTON = 'B+P',
  B_PLUS_2PROTON = 'B+2P',
  EC_ALPHA = 'ECA',
  EC_PROTON = 'ECP',
  EC_2PROTON = 'EC2P',
  EC_SF = 'ECSF',
  EC_B_PLUS = 'EC+B+'
}

export enum NuclideCategory {
  STABLE = 1,
  ALPHA = 2,
  BETA_MINUS = 3,
  BETA_PLUS = 4,
  NON_EXISTENT = 5
}

export interface NuclideData {
  z: number;
  a: number;
  symbol: string;
  name: string;
  halfLifeText: string;
  halfLifeSeconds: number;
  decayModes: DecayMode[];
  branches: BranchingRatio[];
  category: NuclideCategory;
  isStable: boolean;
  exists: boolean;
  description?: string;
  isProtonDripLine: boolean;
  isNeutronDripLine: boolean;
}

export type NuclideId = `${number}-${number}`;

export interface BranchingRatio {
  mode: DecayMode;
  ratio: number;
}

export interface NuclideRecord {
  z: number;
  a: number;
  branches: BranchingRatio[];
  halflife: number;
  category: NuclideCategory;
}
