
import React, { useCallback } from 'react';
import { GameState, DecayMode, NuclideData, EntityType } from '../types';

import { COMBO_WINDOW_MS } from '../constants/gameConfig';
import { MAX_ENERGY, SCORE_FACTORS } from '../constants/economy';
import { REASON } from '../constants/gameOverReason';
import { TITLES } from '../constants/titles';

import { getNuclideDataSync } from '../services/nuclideService';
import { calculateDecayEffects, getDecayDeltas } from '../physics/decaySystem';
import { generateEntities } from '../engine/gameLogic';
import { processUnlocks } from '../engine/unlockSystem';
import { DiscoveryContext } from '../engine/stateTransitions';
import { resolveStabilityCrisis } from '../engine/stabilityManager';
import { getNextTutorialMessage, calculateTutorialFlagUpdates } from '../engine/tutorialManager';
import { emitShake, emitFlash, emitTTS } from '../engine/events/gameEvents';

export const useDecayController = (
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    dispatchDiscovery: (nextNuclide: NuclideData, context: DiscoveryContext) => void,
    setLastDecayEvent: (val: { mode: DecayMode; timestamp: number } | null) => void,
    setLastFinalCombo: (val: { count: number; id: number } | null) => void,
    stopAutoMove: () => void
) => {

    const handleDecayAction = useCallback((mode: DecayMode) => {
        stopAutoMove(); 
        if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
        
        const currentTime = Date.now();
        let actualMode = mode;

        // Check if Daredevil skill (Hard Mode) is active
        const isDaredevilActive = gameState.unlockedGroups.includes(TITLES.DAREDEVIL) && !gameState.disabledSkills.includes(TITLES.DAREDEVIL);

        if (mode === DecayMode.UNKNOWN) {
            const candidates = [DecayMode.GAMMA];
            const checkModes = [
                DecayMode.ALPHA, 
                DecayMode.BETA_MINUS, 
                DecayMode.BETA_PLUS, 
                DecayMode.PROTON_EMISSION, 
                DecayMode.NEUTRON_EMISSION,
                DecayMode.SPONTANEOUS_FISSION,
            ];
            
            checkModes.forEach(m => {
                const deltas = getDecayDeltas(m);
                const targetZ = gameState.currentNuclide.z + deltas.dZ;
                const targetA = gameState.currentNuclide.a + deltas.dA;
                
                if (isDaredevilActive || getNuclideDataSync(targetZ, targetA).exists) {
                    candidates.push(m);
                }
            });
            
            actualMode = candidates[Math.floor(Math.random() * candidates.length)];
        }

        const isAnnihilationSkillActive = gameState.unlockedGroups.includes(TITLES.PAIR_ANNIHILATION) && !gameState.disabledSkills.includes(TITLES.PAIR_ANNIHILATION);

        const decayResult = calculateDecayEffects(
            actualMode, 
            gameState.currentNuclide,
            gameState.playerPos,
            gameState.gridEntities,
            currentTime, 
            isAnnihilationSkillActive, 
            !gameState.disabledSkills.includes(TITLES.FISSION), 
            gameState.unlockedGroups.includes(TITLES.NEUTRONIZATION) && !gameState.disabledSkills.includes(TITLES.NEUTRONIZATION)
        );

        if (decayResult.dZ === 0 && decayResult.dA === 0 && decayResult.trigger === "") return; 
        
        setLastDecayEvent({ 
            mode: (actualMode === DecayMode.SPONTANEOUS_FISSION && gameState.disabledSkills.includes(TITLES.FISSION)) ? DecayMode.ALPHA : actualMode, 
            timestamp: currentTime 
        });
        
        // --- UI Effects triggered via Event Bus ---
        if (decayResult.shouldShake) emitShake();
        if (decayResult.shouldFlash) emitFlash(actualMode === DecayMode.SPONTANEOUS_FISSION ? 'bg-yellow-400' : 'bg-neon-blue');
        if (decayResult.speechOverride) emitTTS(decayResult.speechOverride);

        const newData = getNuclideDataSync(gameState.currentNuclide.z + decayResult.dZ, gameState.currentNuclide.a + decayResult.dA);
        if (!newData.exists) {
            const isDaredevilAttempt = !gameState.currentNuclide.isStable && (gameState.currentNuclide.isProtonDripLine || gameState.currentNuclide.isNeutronDripLine);
            setGameState(prev => {
                const isDaredevilActiveNow = prev.unlockedGroups.includes(TITLES.DAREDEVIL) && !prev.disabledSkills.includes(TITLES.DAREDEVIL);
                if (isDaredevilActiveNow) {
                    const crisisUpdate = resolveStabilityCrisis(prev, REASON.DECAY_FAILED, isDaredevilAttempt, false);
                    return { ...prev, ...crisisUpdate };
                } else {
                    const hpPenalty = 20;
                    const newHp = Math.max(0, prev.hp - hpPenalty);
                    const failMsg = `⚠️ Decay failed: Target nuclide is outside the drip lines.`;
                    if (newHp === 0) {
                         const crisisUpdate = resolveStabilityCrisis(prev, REASON.DECAY_FAILED, isDaredevilAttempt, false);
                         return { ...prev, ...crisisUpdate, messages: [...prev.messages, failMsg].slice(-10) };
                    }
                    return { ...prev, hp: newHp, messages: [...prev.messages, failMsg].slice(-10) };
                }
            });
            return;
        }

        const rawCombo = (currentTime - gameState.lastComboTime <= COMBO_WINDOW_MS) ? gameState.combo + 1 : 1;
        const baseActionPoints = newData.a * SCORE_FACTORS.MASS_MULTIPLIER;
        const stabilityReward = newData.isStable ? SCORE_FACTORS.STABLE_BONUS : SCORE_FACTORS.UNSTABLE_BONUS;
        const totalBaseActionPoints = baseActionPoints + stabilityReward + decayResult.actionBonusScore;
        const totalActionDelta = totalBaseActionPoints * rawCombo;

        if (!gameState.masteredDecays.includes(actualMode) && gameState.playerLevel < 6) {
            emitTTS("Mastery Level Up");
        }

        dispatchDiscovery(newData, {
            method: decayResult.trigger,
            pz: gameState.currentNuclide.z,
            pa: gameState.currentNuclide.a,
            addedScore: totalBaseActionPoints,
            chargesUsed: 0,
            inducedDecayMode: actualMode
        });

        setGameState(prev => {
            const unlockResult = processUnlocks(
                prev.unlockedElements, prev.unlockedGroups, newData.z, newData.a, 
                false, !!decayResult.isAnnihilation, false, false, 0, 
                false, false, false, false, false, 
                prev.decayStats[DecayMode.BETA_PLUS] + (actualMode === DecayMode.BETA_PLUS ? 1 : 0), 
                prev.decayStats[DecayMode.BETA_MINUS] + (actualMode === DecayMode.BETA_MINUS ? 1 : 0)
            );
            
            if (newData.isStable && rawCombo >= 2) setLastFinalCombo({ count: rawCombo, id: Date.now() }); 

            const dripMsg = (!newData.isStable && (newData.isProtonDripLine || newData.isNeutronDripLine)) ? ["⚠️ Danger: Drip line limit"] : [];

            const nextTurn = prev.turn + 1;
            const nextMsg = getNextTutorialMessage(prev, 'DECAY_PERFORMED', { nextNuclide: newData, currentTurn: nextTurn });
            const tutorialUpdates = calculateTutorialFlagUpdates(prev, nextMsg, nextTurn, 'DECAY_PERFORMED');

            // Demon core unlock spawn
            let finalEntities = decayResult.newGridEntities;
            if (unlockResult.updatedGroups.includes(TITLES.DAREDEVIL) && !prev.unlockedGroups.includes(TITLES.DAREDEVIL)) {
                finalEntities = generateEntities(1, finalEntities, prev.playerPos, nextTurn, EntityType.ANTI_NUCLIDE);
            }

            return { 
                ...prev, 
                ...tutorialUpdates,
                playerPos: decayResult.newPosition || prev.playerPos, 
                energyPoints: Math.min(MAX_ENERGY, prev.energyPoints + (decayResult.energyBonus || 0)), 
                tutorialMessage: nextMsg, 
                unlockedElements: unlockResult.updatedElements, 
                unlockedGroups: unlockResult.updatedGroups, 
                gridEntities: finalEntities, 
                effects: [...prev.effects, { id: Math.random().toString(36).substr(2, 9), type: actualMode, position: { ...prev.playerPos }, timestamp: currentTime }, ...decayResult.additionalEffects], 
                score: prev.score + totalActionDelta + unlockResult.scoreBonus, 
                hp: Math.min(prev.maxHp, prev.hp + (newData.isStable ? 10 : 0)), 
                messages: [...prev.messages, (decayResult.dZ !== 0 || decayResult.dA !== 0) ? `${decayResult.trigger} into ${newData.name}.` : decayResult.trigger, ...unlockResult.messages, ...dripMsg, ...decayResult.extraMessages].slice(-10), 
                combo: rawCombo,
                maxCombo: Math.max(prev.maxCombo, rawCombo),
                lastComboTime: currentTime,
                decayStats: { ...prev.decayStats, [actualMode]: (prev.decayStats[actualMode] || 0) + 1 },
                consecutiveProtons: 0, 
                consecutiveNeutrons: 0, 
                consecutiveElectrons: 0, 
                lastConsumedType: null
            };
        });
    }, [gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, gameState.currentNuclide, gameState.disabledSkills, gameState.lastComboTime, gameState.combo, gameState.playerPos, gameState.gridEntities, stopAutoMove, setGameState, dispatchDiscovery, setLastDecayEvent, setLastFinalCombo]);

    const handlePlayerInteract = useCallback(() => {
        stopAutoMove(); 
        if (gameState.gameOver || gameState.loadingData || gameState.isTimeStopped) return;
        if (gameState.currentNuclide.isStable) return;
        
        let activeMode = gameState.currentNuclide.decayModes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) 
                        || (gameState.currentNuclide.decayModes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : null);
        
        if (activeMode) handleDecayAction(activeMode);
    }, [gameState.gameOver, gameState.loadingData, gameState.isTimeStopped, gameState.currentNuclide, stopAutoMove, handleDecayAction]);

    return {
        handleDecayAction,
        handlePlayerInteract
    };
};
