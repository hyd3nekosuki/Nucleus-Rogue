import { nuclideDatabaseExtended } from './nuclideDatabaseExtended';
import { NuclideRecord, NuclideId } from '../types';
import { parseNuclideRecord } from '../utils/nuclideParser';

/**
 * An immutable, pre-calculated Map for O(1) nuclide physical data lookups.
 * Built once during application initialization with full validation.
 * 
 * Single Source of Truth for all known atomic data.
 */
const buildRepository = (): Map<NuclideId, NuclideRecord> => {
    const repo = new Map<NuclideId, NuclideRecord>();
    let corruptCount = 0;

    for (const zStr in nuclideDatabaseExtended) {
        const z = parseInt(zStr);
        const zData = nuclideDatabaseExtended[z];
        if (!zData) continue;

        const segments = zData.split(',');
        for (const segment of segments) {
            const record = parseNuclideRecord(z, segment);
            if (record) {
                const id: NuclideId = `${record.z}-${record.a}`;
                repo.set(id, record);
            } else {
                corruptCount++;
            }
        }
    }

    if (corruptCount > 0) {
        console.error(`Nuclide Repository: Build complete. Skipped ${corruptCount} corrupt records.`);
    }

    return repo;
};

export const NUCLIDE_REPOSITORY: Map<NuclideId, NuclideRecord> = buildRepository();

/**
 * Get all available mass numbers (A) for a given atomic number (Z).
 * Performance optimized to avoid repetitive string conversions.
 */
export const getRepositoryValidAsForZ = (z: number): number[] => {
    const validAs: number[] = [];
    const prefix = `${z}-`;
    
    for (const id of NUCLIDE_REPOSITORY.keys()) {
        if (id.startsWith(prefix)) {
            const a = parseInt(id.substring(prefix.length));
            if (!isNaN(a)) {
                validAs.push(a);
            }
        }
    }
    return validAs.sort((a, b) => a - b);
};
