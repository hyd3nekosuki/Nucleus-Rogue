
import { useMemo } from 'react';
import { GameState, NuclideData } from '../types';
import { parseNuclideCommand, solveParticleRequirements } from '../engine/particleEngine';
import { getNuclideDataSync } from '../services/nuclideService';

export interface OverrideValidationResult {
    isReachable: boolean;
    targetData?: NuclideData;
    idsToConsume?: string[];
}

/**
 * Quantum Override Validation Engine
 * ユーザーが入力した核種コマンドを解析し、盤面上の粒子資源で到達可能か（方程式の解があるか）をリアルタイムで検証します。
 * この機能はマスタリーレベル 6（論文引用）の到達時にのみ有効化されます。
 */
export const useOverrideValidator = (inputValue: string, gameState: GameState): OverrideValidationResult | null => {
    return useMemo(() => {
        // レベルチェック: マスタリーレベル 6 未満の場合はバリデーションを行わない
        if (gameState.playerLevel < 6) return null;

        const trimmedInput = inputValue.trim();
        if (!trimmedInput) return null;

        // Step 1: 目標核種の特定（解析フェーズ）
        // 入力文字列（例: "Au-197"）を原子座標 (Z, A) に変換
        const targetCoords = parseNuclideCommand(trimmedInput);
        if (!targetCoords) return null;

        // Step 2: 資源方程式の解決（計算フェーズ）
        // 質量保存・電荷保存の法則に基づき、目標状態へ遷移するために必要な粒子の組み合わせを盤面から探索
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

        // 到達可能な場合（量子共鳴が確立）
        return {
            isReachable: true,
            targetData,
            idsToConsume: requirements.idsToConsume
        };
        
    }, [
        inputValue, 
        gameState.playerLevel, 
        gameState.currentNuclide.z, 
        gameState.currentNuclide.a, 
        gameState.gridEntities
    ]);
};
