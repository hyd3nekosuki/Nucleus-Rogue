
import { GameState, NuclideData, NuclideState, HistoryEntry } from '../types';
import { calculateComboCompletionBonus } from './scoreLogic';
import { processUnlocks } from './unlockSystem';
import { getNuclideDataSync } from '../services/nuclideService';

export interface DiscoveryContext {
    method: string;
    pz: number | null;
    pa: number | null;
    addedScore: number; // 明示的に加算されたスコアを受け取るように追加
}

/**
 * Pure transition logic for when a new nuclide is discovered.
 * Handles history recording, combo start tracking, and progression unlocks.
 */
export const handleDiscoveryTransition = (
    prev: GameState,
    nextNuclide: NuclideData,
    context: DiscoveryContext
): { 
    nextState: GameState, 
    newHistoryEntry: HistoryEntry 
} => {
    const nextTurn = prev.turn;
    
    // 1. Create history entry
    const newHistoryEntry: HistoryEntry = {
        turn: nextTurn,
        name: nextNuclide.name,
        symbol: nextNuclide.symbol,
        z: nextNuclide.z,
        a: nextNuclide.a,
        method: context.method,
        pz: context.pz,
        pa: context.pa
    };

    let nextState = { ...prev, currentNuclide: nextNuclide };

    // 2. Handle Combo Start Tracking
    // We check !prev.comboStartNuclide to ensure we record the very first progenitor of the chain
    if (!prev.comboStartNuclide && (prev.combo > 0 || nextState.combo > 0)) {
        // Record the nucleus we were at BEFORE the chain-starting action
        const progenitorData = getNuclideDataSync(context.pz || 0, context.pa || 0);
        nextState.comboStartNuclide = { z: progenitorData.z, a: progenitorData.a };
        // CRITICAL: Record whether we started from an unstable state
        nextState.comboStartedUnstable = !progenitorData.isStable;
    }
    
    // BUG FIX: prev.score は既に更新後の値を持っている可能性があるため、引数の addedScore を直接使う
    const scoreDiff = context.addedScore;
    nextState.comboScore = (prev.combo === 0 && nextState.combo <= 1) ? scoreDiff : prev.comboScore + scoreDiff;

    // Note: Temporal Inversion check is moved exclusively to hooks/useComboTimer.ts 
    // to ensure it only triggers at the natural conclusion of the chain.

    // 3. Handle Stability Reset (Chains end on stability)
    if (nextNuclide.isStable && (prev.combo > 0 || nextState.combo > 0)) {
        nextState.combo = 0;
        nextState.comboScore = 0;
        nextState.comboStartNuclide = undefined;
        nextState.comboStartedUnstable = false;
    }

    return { nextState, newHistoryEntry };
};
