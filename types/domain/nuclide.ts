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
  NEUTRON_EMISSION = 'NEUTRON_EMISSION',
  SPONTANEOUS_FISSION = 'SPONTANEOUS_FISSION',
  ELECTRON_CAPTURE = 'ELECTRON_CAPTURE',
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
  NUCLEOSYNTHESIS_ZAP = 'NUCLEOSYNTHESIS_ZAP'
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
  category: NuclideCategory;
  isStable: boolean;
  exists: boolean;
  description?: string;
  isProtonDripLine: boolean;
  isNeutronDripLine: boolean;
}

export type NuclideId = `${number}-${number}`;

export interface NuclideRecord {
  z: number;
  a: number;
  mode: DecayMode;
  halflife: number;
  category: NuclideCategory;
}
