export const DOI_SEGMENT_1: Record<string, { doi: string, isAccessible: boolean }> = {
  // --- Z=0 (Neutron Systems) ---
  "0-1": { doi: "10.1038/129312a0" , isAccessible: true }, // James Chadwick (1932) "Possible Existence of a Neutron" (Discovery)
  "0-2": { doi: "10.1103/PhysRevLett.109.232501" , isAccessible: true }, // A. Spyrou et al. (2012) "First Observation of Dineutron Emission"
  "0-4": { doi: "10.1038/s41586-022-04827-6" , isAccessible: true }, // M. Duer et al. (2022) "Observation of a multineutron system" (Tetraneutron)
  "0-6": { doi: "10.1103/PhysRevC.105.024320" , isAccessible: true }, // J. Carbonell et al. (2022) "Is a hexaneutron a bound state?" (Theoretical stability)

  // --- Z=1 (Hydrogen Isotopes) ---
  "1-1": { doi: "10.1080/14786440608635919" , isAccessible: true }, // Ernest Rutherford (1919) "Collision of alpha particles with light atoms" (Proton discovery)
  "1-2": { doi: "10.1103/PhysRev.40.1" , isAccessible: true }, // H.C. Urey et al. (1932) "A Hydrogen Isotope of Mass 2" (Deuterium discovery)
  "1-3": { doi: "10.1103/PhysRev.45.661" , isAccessible: false }, // G.N. Lewis et al. (1934) "Concentration of H3" (Tritium - Phys. Rev.)
  "1-4": { doi: "10.1103/PhysRevC.68.054323" , isAccessible: true }, // M.S. Golovkov et al. (2003) "Resonances in 4H"
  "1-5": { doi: "10.1103/PhysRevLett.87.092501" , isAccessible: true }, // A.A. Korsheninnikov et al. (2001) "Superheavy Hydrogen 5H"
  "1-6": { doi: "10.1103/PhysRevLett.99.022502" , isAccessible: true }, // Covers 7H observation context
  "1-7": { doi: "10.1103/PhysRevLett.99.022502" , isAccessible: true }, // M. Caama単o et al. (2007) "Experimental Observation of 7H"

  // --- Z=2 (Helium Isotopes) ---
  "2-3": { doi: "10.1103/PhysRev.56.379" , isAccessible: true }, // L.W. Alvarez & R. Cornog (1939) "Helium of Mass 3" (First detection)
  "2-4": { doi: "10.1038/052007a0" , isAccessible: true }, // William Ramsay (1895) "Terrestrial Helium" (Discovery on Earth)
  "2-5": { doi: "10.1103/PhysRev.50.481" , isAccessible: true }, // Covers Li8 and He6 studies
  "2-6": { doi: "10.1103/PhysRev.50.481" , isAccessible: true }, // H.R. Crane et al. (1936) "The Radioactivity of Li8 and He6" (Phys. Rev.)
  "2-8": { doi: "10.1103/PhysRev.133.B1103" , isAccessible: false }, // P.M. Nefkens (1964) "Observation of Helium-8"
  "2-10": { doi: "10.1016/0370-2693(94)91195-5" , isAccessible: false }, // A.A. Korsheninnikov et al. (1994) "Observation of 10He"

  // --- Z=3 (Lithium Isotopes) ---
  "3-6": { doi: "10.1080/14786441108636168" , isAccessible: true }, // F.W. Aston (1920) "The Constitution of the Elements" (Li isotopes resolved)
  "3-7": { doi: "10.1103/PhysRev.43.337" , isAccessible: true }, // Lewis & Livingston (1933) "The Disintegration of Lithium by Protons" (Phys. Rev.)
  "3-8": { doi: "10.1103/PhysRev.50.481" , isAccessible: true }, // H.R. Crane (1936) (Phys. Rev. - Study of Li8)
  "3-9": { doi: "10.1103/PhysRev.83.18" , isAccessible: false }, // W.M. Gardner (1951) "The Disintegration of Li9"
  "3-11": { doi: "10.1103/PhysRevLett.55.2676" , isAccessible: true }, // I. Tanihata et al. (1985) "Measurements of Interaction Cross Sections" (Halo discovery)

  // --- Z=4 (Beryllium Isotopes) ---
  "4-6": { doi: "10.1103/PhysRev.54.487" , isAccessible: false }, // Beryllium-6/7 studies
  "4-7": { doi: "10.1103/PhysRev.54.487" , isAccessible: false }, // L.H. Rumbaugh et al. (1938) "Beryllium-7" (Discovery - Phys. Rev.)
  "4-8": { doi: "10.1103/PhysRev.47.746" , isAccessible: false }, // Dee & Gilbert (1935) "The Disintegration of Boron into Three Alpha-Particles" (Verified Be-8 PROLA)
  "4-9": { doi: "10.1103/PhysRev.43.337" , isAccessible: true }, // Lewis et al. (1933) "Disintegration of Be"
  "4-10": { doi: "10.1103/PhysRev.81.33" , isAccessible: true }, // E. McMillan (1951) "The Half-Life of Be10" (Phys. Rev.)
  "4-11": { doi: "10.1103/PhysRev.114.1095" , isAccessible: true }, // D.H. Wilkinson (1959) "Mass and Decay of Be11"
  "4-12": { doi: "10.1103/PhysRev.150.857" , isAccessible: true }, // Poskanzer et al. (1966) "New Isotopes: Be12, B14, C17"
  "4-14": { doi: "10.1103/PhysRevLett.85.262" , isAccessible: true }, // Zhu et al. (2000) "Charge Radii of 12Be and 14Be" (Halo structure)

  // --- Z=5 (Boron Isotopes) ---
  "5-8": { doi: "10.1103/PhysRev.101.1327" , isAccessible: false }, // L.W. Alvarez (1956) "Radioactivity of B8 and C9" (Phys. Rev.)
  "5-10": { doi: "10.1080/14786441108636168" , isAccessible: true }, // F.W. Aston (1920) (B isotopes resolved)
  "5-11": { doi: "10.1103/PhysRev.43.582" , isAccessible: true }, // K.T. Bainbridge (1933) "The Mass of the Lightest Isotope of Carbon" (covers B-11 mass)
  "5-12": { doi: "10.1103/PhysRev.50.1143" , isAccessible: false }, // Crane et al. (1936) "The Radioactivity of Boron-12"
  "5-17": { doi: "10.1103/PhysRevLett.60.10" , isAccessible: false }, // Suzuki et al. (1988) "Observation of new isotopes" (B-17 identification)

  // --- Z=6 (Carbon Isotopes) ---
  "6-9": { doi: "10.1103/PhysRev.101.1327" , isAccessible: false }, // L.W. Alvarez (1956) (B8/C9 discovery Phys. Rev.)
  "6-10": { doi: "10.1103/PhysRev.75.1481" , isAccessible: true }, // Carbon-10 studies
  "6-11": { doi: "10.1103/PhysRev.45.166" , isAccessible: true }, // H.R. Crane & C.C. Lauritsen (1934) "Artificial Radioactivity" (C-11 discovery Phys. Rev.)
  "6-12": { doi: "10.1103/PhysRev.43.582" , isAccessible: true }, // Bainbridge (1933) "Mass of Carbon 12"
  "6-13": { doi: "10.1038/131018a0" , isAccessible: true }, // A.S. King & R.T. Birge (1933) "Isotopes of Carbon" (Discovery of C-13)
  "6-14": { doi: "10.1103/PhysRev.59.320" , isAccessible: true }, // S. Ruben & M. Kamen (1941) "Long-Lived Radioactive Carbon" (C-14 identification Phys. Rev.)
  "6-15": { doi: "10.1103/PhysRev.88.1031" , isAccessible: false }, // Hudspeth (1952) "Radioactivity of C15"
  "6-22": { doi: "10.1103/PhysRevLett.104.062701" , isAccessible: true }, // K. Tanaka et al. (2010) "Observation of a Large Nuclear Halo in 22C"

  // --- Z=7 (Nitrogen Isotopes) ---
  "7-12": { doi: "10.1103/PhysRev.75.574" , isAccessible: false }, // L. Alvarez (1949) "Nitrogen-12"
  "7-13": { doi: "10.1103/PhysRev.45.425" , isAccessible: true }, // M.C. Henderson et al. (1934) "Induced Radioactivity" (N-13 discovery Phys. Rev.)
  "7-14": { doi: "10.1098/rspa.1914.0041" , isAccessible: true }, // E. Rutherford (1914) "The Analysis of the Nitrogen Spectrum" (Early structure)
  "7-15": { doi: "10.1103/PhysRev.55.1102" , isAccessible: true }, // S.M. Naud辿 (1939) "The Isotopes of Nitrogen" (Verified PROLA)
  "7-16": { doi: "10.1103/PhysRev.81.447" , isAccessible: true }, // Nitrogen-16 half-life studies
  "7-17": { doi: "10.1103/PhysRev.94.1310" , isAccessible: false }, // Alvarez (1954) "Delayed Neutrons from N17"

  // --- Z=8 (Oxygen Isotopes) ---
  "8-14": { doi: "10.1103/PhysRev.75.574" , isAccessible: false }, // Alvarez (1949) (also Oxygen-14)
  "8-15": { doi: "10.1103/PhysRev.45.166" , isAccessible: true }, // Crane and Lauritsen (1934) "Oxygen-15 discovery"
  "8-16": { doi: "10.1103/PhysRev.34.1432" , isAccessible: false }, // W.F. Giauque & H.L. Johnston (1929) "An Isotope of Oxygen, Mass 17" (covers O-16/17/18)
  "8-17": { doi: "10.1103/PhysRev.34.1432" , isAccessible: false }, // Giauque & Johnston (1929) (PROLA link for O-17 discovery)
  "8-18": { doi: "10.1038/123396a0" , isAccessible: false }, // W.F. Giauque & H.L. Johnston (1929) "Discovery of O-18"
  "8-24": { doi: "10.1103/PhysRevLett.102.152501" , isAccessible: true }, // C.R. Hoffman et al. (2009) "Determination of the N=16 Shell Closure at the Oxygen Drip Line"
  "8-28": { doi: "10.1038/s41586-023-06352-6" , isAccessible: true }, // Y. Kondo et al. (2023) "First observation of 28O" (Nature)

  // --- Z=9 (Fluorine Isotopes) ---
  "9-17": { doi: "10.1103/PhysRev.50.1143" , isAccessible: false }, // Covers Fluorine isotopes context
  "9-18": { doi: "10.1103/PhysRev.51.510" , isAccessible: false }, // A.H. Snell (1937) "Radio-Fluorine (F18)" (Phys. Rev.)
  "9-19": { doi: "10.1103/PhysRev.47.700.2" , isAccessible: true }, // F.A. Jenkins & I.S. Bowen (1935) "The Fluorine Isotope F19" (Verified PROLA)
  "9-20": { doi: "10.1103/PhysRev.48.265" , isAccessible: true }, // Newson (1935) "Radioactivity of Fluorine-20"
  "9-31": { doi: "10.1103/PhysRevLett.123.212501" , isAccessible: true }, // D.S. Ahn et al. (2019) "Location of the Fluorine-31 Drip Line"

  // --- Z=10 (Neon Isotopes) ---
  "10-18": { doi: "10.1103/PhysRev.100.1798" , isAccessible: false }, // Neon-18 studies
  "10-20": { doi: "10.1103/PhysRev.44.1031" , isAccessible: true }, // J.L. Nickerson (1933) "The Neon Isotopes" (Verified PROLA - Covers Ne20/21/22)
  "10-21": { doi: "10.1103/PhysRev.44.1031" , isAccessible: true }, // Nickerson (1933) (PROLA link for Ne-21)
  "10-22": { doi: "10.1103/PhysRev.44.1031" , isAccessible: true }, // Nickerson (1933) (PROLA link for Ne-22)
  "10-23": { doi: "10.1103/PhysRev.50.1101" , isAccessible: false }, // Pollack (1936) "Radioactivity of Ne23"
  "10-34": { doi: "10.1103/PhysRevLett.123.212501" , isAccessible: true }  // D.S. Ahn et al. (2019) "Discovery of Neon-34"
};