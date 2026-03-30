import { HistoryEntry, NuclideData } from '../../types';
import { LOG_MESSAGES } from '../../constants';

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
        /**
         * Update Logic:
         * 1. If the new method is scientific (not "Unknown"), always overwrite the lineage.
         *    This allows the Evolution Map to reflect the LATEST path taken by the player.
         * 2. If the new method is "Unknown" (from defeating an enemy), only update lineage 
         *    if the existing record is also "Unknown". This protects existing scientific 
         *    pedigrees from being downgraded to "Unknown".
         * 3. lastTurn and isEngraved are always updated to the latest session state.
         */
        const isNewScientificAction = method !== LOG_MESSAGES.HISTORY.UNKNOWN;
        const isExistingRecordUnknown = existing.method === LOG_MESSAGES.HISTORY.UNKNOWN || !existing.method;
        const shouldUpdateLineage = isNewScientificAction || isExistingRecordUnknown;

        return {
            ...history,
            [key]: {
                ...existing,
                lastTurn: turn,
                method: shouldUpdateLineage ? method : existing.method,
                pz: shouldUpdateLineage ? pz : existing.pz,
                pa: shouldUpdateLineage ? pa : existing.pa,
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