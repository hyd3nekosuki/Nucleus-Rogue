export const REASON = {
  RADIOACTIVE_DECAY: "RADIOACTIVE DECAY",  // due to HP temporal decreasing by radio active decay
  DECAY_FAILED: "DECAY_FAILED", // Radioactive decay fails because descendant nuclide does not exist or is outside the drip lines.
  TRANSFORMATION_FAILED: "TRANSFORMATION_FAILED", // Nuclear transformation fails because escendant nuclide does not exist or is outside the drip lines.
  NUCLEUS_COLLAPSE: "NUCLEUS COLLAPSE", // impossible configuration
  FATAL_CAPTURE: "FATAL_CAPTURE", // due to HP=0 by capturing particle
  ANNIHILATION: "ANNIHILATION", // electron-positron annihilation (legacy/general)
  ELECTRON_ANNIHILATION: "ELECTRON_ANNIHILATION", // player e- vs e+
  POSITRON_ANNIHILATION: "POSITRON_ANNIHILATION", // player e+ vs e-
  NOTHINGNESS: "NOTHINGNESS",
  UNKNOWN: "UNKNOWN"
}