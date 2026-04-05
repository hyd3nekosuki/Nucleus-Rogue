/**
 * Particle Predicate Utilities
 * Centralized logic for identifying special particles (leptons) 
 * to improve code readability and maintainability.
 */

interface Particle {
  z: number;
  a: number;
}

/**
 * Checks if a nuclide/particle is a positron (e+).
 */
export const isPositron = (particle: Particle): boolean => {
  return particle.z === 1 && particle.a === 0;
};

/**
 * Checks if a nuclide/particle is an electron (e-).
 */
export const isElectron = (particle: Particle): boolean => {
  return particle.z === -1 && particle.a === 0;
};

/**
 * Checks if a nuclide/particle is a lepton (electron or positron).
 */
export const isLepton = (particle: Particle): boolean => {
  return particle.a === 0 && (particle.z === 1 || particle.z === -1);
};

/**
 * Checks if a nuclide/particle is a neutron (n).
 */
export const isNeutron = (particle: Particle): boolean => {
  return particle.z === 0 && particle.a === 1;
};

/**
 * Checks if a nuclide/particle is a proton (p).
 */
export const isProton = (particle: Particle): boolean => {
  return particle.z === 1 && particle.a === 1;
};
