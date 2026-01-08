
import { useMemo } from 'react';
import { GameState, NuclideData } from '../types';
import { parseNuclideCommand, solveParticleRequirements } from '../engine/particleEngine';
import { getNuclideDataSync } from '../services/nuclideService';

export interface CheatValidationResult {
    isReachable: boolean;
    targetData?: NuclideData;
    idsToConsume?: string[];
}

/**
 * Step 3: Dynamic Validation Engine Implementation
 * Executes parsing and resource equation solving in real-time as the user types.
 * Restricted to Mastery Level 6.
 */
export const useCheatEngine = (inputValue: string, gameState: GameState): CheatValidationResult | null => {
    return useMemo(() => {
        // レベルチェック: gameState.playerLevel === 6 でない場合は即座に終了。
        if (gameState.playerLevel < 6) return null;

        const trimmedInput = inputValue.trim();
        if (!trimmedInput) return null;

        // Step 1: 目標核種の特定（解析フェーズ）
        const targetCoords = parseNuclideCommand(trimmedInput);
        if (!targetCoords) return null;

        // 資源カウントと到達可能性判定（計算フェーズ）
        // Step 2の方程式を満たす組み合わせを探索
        const requirements = solveParticleRequirements(
            gameState.currentNuclide.z,
            gameState.currentNuclide.a,
            targetCoords.z,
            targetCoords.a,
            gameState.gridEntities
        );

        const targetData = getNuclideDataSync(targetCoords.z, targetCoords.a);

        // 到達不能な場合
        if (!requirements) {
            return {
                isReachable: false,
                targetData
            };
        }

        // 到達可能な場合
        // 最適解（最小粒子数）は solveParticleRequirements 内で既に選択されている
        return {
            isReachable: true,
            targetData,
            idsToConsume: requirements.idsToConsume
        };
        
        // 依存配列により、入力内容、レベル、現在の核種、盤面資源のいずれかが変化した時のみ再計算
    }, [
        inputValue, 
        gameState.playerLevel, 
        gameState.currentNuclide.z, 
        gameState.currentNuclide.a, 
        gameState.gridEntities
    ]);
};
