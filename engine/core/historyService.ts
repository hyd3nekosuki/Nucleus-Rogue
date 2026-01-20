import { HistoryEntry, NuclideData } from '../../types';

/**
 * Pure function to register or update a nuclide discovery in the evolution history.
 * If the nuclide already exists in history, it updates the last turn and discovery data
 * while preserving metadata like 'isEngraved', unless forceEngraved is true.
 * 
 * @param history Current evolution history map
 * @param nuclide The nuclide to register
 * @param method The discovery method name
 * @param pz Parent Z (null for origin/unknown)
 * @param pa Parent A (null for origin/unknown)
 * @param turn Current game turn
 * @param forceEngraved If true, ensures the isEngraved flag is set to true
 */
export const registerHistoryEntry = (
    history: Record<string, HistoryEntry>,
    nuclide: NuclideData,
    method: string,
    pz: number | null,
    pa: number | null,
    turn: number,
    forceEngraved: boolean = false
): Record<string, HistoryEntry> => {
    const key = `${nuclide.z}-${nuclide.a}`;
    const existing = history[key];

    if (existing) {
        // Update existing entry: 
        // Preserve original discovery method and parents if they already exist (not null/Origin)
        // This ensures a "Nuclear Fusion" record isn't downgraded to "Unknown" when defeated later.
        return {
            ...history,
            [key]: {
                ...existing,
                lastTurn: turn,
                method: (existing.method && existing.method !== "Unknown") ? existing.method : method,
                pz: existing.pz !== null ? existing.pz : pz,
                pa: existing.pa !== null ? existing.pa : pa,
                isEngraved: forceEngraved || !!existing.isEngraved
            }
        };
    }

    // Create a brand new entry
    const newEntry: HistoryEntry = {
        firstTurn: turn,
        lastTurn: turn,
        name: nuclide.name,
        symbol: nuclide.symbol,
        z: nuclide.z,
        a: nuclide.a,
        method,
        pz,
        pa,
        isEngraved: forceEngraved
    };

    return {
        ...history,
        [key]: newEntry
    };
};