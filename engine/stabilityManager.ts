
import { GameState, DecayMode } from '../types';
import { calculateReincarnationTargets } from './particleEngine';
import { REASON } from '../constants/gameOverReason';
import { processUnlocks } from './unlockSystem';
import { TITLES } from '../constants/titles';

/**
 * 安定性の危機を解決するための統合管理ユーティリティ。
 * 
 * 修正点: 生存ルート（時間反転・転生）でも実績判定（processUnlocks）を
 * 実行し、称号がその場で解禁されるようにしました。
 * また、対消滅時には全ての生存スキルをバイパスする例外処理を追加しました。
 */
export const resolveStabilityCrisis = (
    state: GameState, 
    reason: string = REASON.UNKNOWN,
    isDaredevilAttempt: boolean = false,
    checkInversion: boolean = true
): Partial<GameState> => {
    
    // 実績チェック（特に生存時にもDaredevilを解禁するため）
    const unlockCheck = (updatedState: Partial<GameState>) => {
        const tempState = { ...state, ...updatedState };
        return processUnlocks(
            tempState.unlockedElements, 
            tempState.unlockedGroups, 
            null, null, 
            false, false, false, false, 0, 
            false, false, false, false, false, 
            0, 0, false, isDaredevilAttempt
        );
    };

    // --- 対消滅の特別処理 ---
    // 対消滅は全てを無に帰すため、時間反転や転生による救済を一切受け付けず即死させます。
    // これにより、対消滅回避による無限エネルギー稼ぎの不整合を解消します。
    if (reason === REASON.NOTHINGNESS) {
        const finalResult = unlockCheck({ hp: 0, gameOver: true });
        return { 
            hp: 0, 
            energyPoints: 0, 
            gameOver: true, 
            gameOverReason: reason,
            unlockedGroups: finalResult.updatedGroups,
            score: state.score + finalResult.scoreBonus,
            messages: [...state.messages, ...finalResult.messages].slice(-10),
            combo: 0, 
            comboScore: 0, 
            // Fix: Corrected comboStartNuclide to comboOrigin as per GameState interface
            comboOrigin: undefined,
            consecutiveProtons: 0,
            consecutiveNeutrons: 0,
            consecutiveElectrons: 0,
            lastConsumedType: null
        };
    }

    // 1. Temporal Inversion (Auto-Stabilization) Check
    if (checkInversion &&
        state.unlockedGroups.includes(TITLES.TEMPORAL_INVERSION) && 
        !state.disabledSkills.includes(TITLES.TEMPORAL_INVERSION) && 
        state.energyPoints >= 5) {
        
        const survivalUpdate: Partial<GameState> = { 
            hp: state.maxHp, 
            energyPoints: Math.max(0, state.energyPoints - 5),
            effects: [
                ...state.effects, 
                { 
                    id: Math.random().toString(36).substr(2, 9), 
                    type: DecayMode.STABILIZE_ZAP, 
                    position: { ...state.playerPos }, 
                    timestamp: Date.now() 
                }
            ]
        };

        const result = unlockCheck(survivalUpdate);
        return {
            ...survivalUpdate,
            unlockedGroups: result.updatedGroups,
            score: state.score + result.scoreBonus,
            messages: [...state.messages, "⏱ AUTO-STABILIZATION: Temporal Inversion triggered!", ...result.messages].slice(-10)
        };
    }

    // 2. Reincarnation Check
    const isDaredevilActive = state.unlockedGroups.includes(TITLES.DAREDEVIL) && !state.disabledSkills.includes(TITLES.DAREDEVIL);
    const reinc = calculateReincarnationTargets(
        state.currentNuclide, 
        state.reincarnationPool, 
        state.evolutionHistory, 
        isDaredevilActive
    );
    
    if (reinc) {
        const { nuclide, usage } = reinc;
        const nextEnergy = Math.floor((state.energyPoints / 2) / 5) * 5;
        
        const reincarnationUpdate: Partial<GameState> = {
            currentNuclide: nuclide,
            hp: state.maxHp,
            playerLevel: 0,
            masteredDecays: [],
            energyPoints: nextEnergy,
            reincarnationPool: {
                p: state.reincarnationPool.p - usage.p,
                n: state.reincarnationPool.n - usage.n,
                e: state.reincarnationPool.e - usage.e
            },
            reincarnations: state.reincarnations + 1,
            combo: 0,
            comboScore: 0,
            // Fix: Changed comboStartNuclide to comboOrigin and removed non-existent comboStartedUnstable
            comboOrigin: undefined,
            consecutiveProtons: 0,
            consecutiveNeutrons: 0,
            consecutiveElectrons: 0,
            lastConsumedType: null
        };

        const result = unlockCheck(reincarnationUpdate);
        return {
            ...reincarnationUpdate,
            unlockedGroups: result.updatedGroups,
            score: state.score + result.scoreBonus,
            messages: [...state.messages, `♻️ REINCARNATION: Reborn as ${nuclide.name}!`, ...result.messages].slice(-10)
        };
    }

    // 3. Normal Death
    const finalResult = unlockCheck({ hp: 0, gameOver: true });
    return { 
        hp: 0, 
        energyPoints: 0, 
        gameOver: true, 
        gameOverReason: reason,
        unlockedGroups: finalResult.updatedGroups,
        score: state.score + finalResult.scoreBonus,
        messages: [...state.messages, ...finalResult.messages].slice(-10),
        combo: 0, 
        comboScore: 0, 
        // Fix: Corrected comboStartNuclide to comboOrigin as per GameState interface
        comboOrigin: undefined,
        consecutiveProtons: 0,
        consecutiveNeutrons: 0,
        consecutiveElectrons: 0,
        lastConsumedType: null
    };
};
