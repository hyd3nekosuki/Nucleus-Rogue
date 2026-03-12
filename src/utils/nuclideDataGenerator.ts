import { CrossSectionRecord } from "../data/neutronReactions/types";

/**
 * Utility to generate nuclide data lines for the neutron reactions data files.
 */

/**
 * Generates a single line of data for the neutron reactions data files.
 * Format: "Z-A": { z: Z, a: A, reactions: { "mode": [thermal, resonance] } },
 */
export function generateNuclideDataLine(z: number, a: number, reactions: Record<string, [number, number]>): string {
  const key = `${z}-${a}`;
  const record: CrossSectionRecord = {
    z,
    a,
    reactions
  };
  
  // Custom stringify to match the style in z0_20.ts
  const reactionsStr = Object.entries(reactions)
    .map(([mode, values]) => `"${mode}": [${values[0]}, ${values[1]}]`)
    .join(", ");
    
  return `  "${key}": { z: ${z}, a: ${a}, reactions: { ${reactionsStr} } },`;
}

/**
 * Parses a JAEA summary table text and returns a Record of reactions.
 * Expected format:
 * fission          585.08           274
 * capture           98.71           139
 */
export function parseJAEASummaryTable(text: string): Record<string, [number, number]> {
  const lines = text.split("\n");
  const reactions: Record<string, [number, number]> = {};
  
  const reactionMap: Record<string, string> = {
    "fission": "n,f",
    "capture": "n,g",
    "n,gamma": "n,g",
    "elastic": "n,n",
    "total": "total",
    "(n,2n)": "n,2n",
    "n,2n": "n,2n",
    "(n,p)": "n,p",
    "n,p": "n,p",
    "(n,a)": "n,a",
    "n,alpha": "n,a",
    "n,a": "n,a"
  };

  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect table start
    if (trimmed.toLowerCase().includes("thermal cross sections") || trimmed.toLowerCase().includes("0.0253 ev")) {
      inTable = true;
      continue;
    }

    // If we are in the table, try to parse lines
    if (inTable) {
      // If we hit a separator or a new section, we might still be in the table or just finished
      if (trimmed.startsWith("---") || trimmed.startsWith("===")) continue;
      
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const name = parts[0].toLowerCase().replace(/,/g, ","); // normalize
        
        let mode = reactionMap[name];
        if (!mode) {
          // Fallback for names like "(n,2n)" or "n,gamma"
          for (const [key, val] of Object.entries(reactionMap)) {
            if (name === key.toLowerCase() || name.includes(key.toLowerCase())) {
              mode = val;
              break;
            }
          }
        }

        if (mode) {
          const thermal = parseFloat(parts[1]);
          const resonance = parts.length >= 3 ? parseFloat(parts[2]) : 0;
          if (!isNaN(thermal)) {
            reactions[mode] = [thermal, isNaN(resonance) ? 0 : resonance];
          }
        }
      }
      
      // If we see a line that doesn't look like a table row and we've already found some reactions, we might be done
      if (Object.keys(reactions).length > 0 && !reactionMap[parts[0].toLowerCase()]) {
        // Check if it's just a header or something
        if (parts[0].toLowerCase() === "reaction" || parts[0].toLowerCase() === "energy") continue;
        // If it's something else, we might have exited the table
        // But for now, let's just keep going until the end of the file or a clear break
      }
    }
  }
  return reactions;
}

// Example usage for U-235:
// const u235Text = `
// fission          585.08           274
// capture           98.71           139
// `;
// const reactions = parseJAEASummaryTable(u235Text);
// console.log(generateNuclideDataLine(92, 235, reactions));
