import { DecayMode } from '../types';
import { 
    createKick, createSnare, createHat, createSynth 
} from './audioInstruments';

/**
 * Rhythmic Sequencer Logic.
 * Commands the Web Audio API to schedule sounds based on the current decay mode and step.
 */
export const playRhythm = (
    mode: DecayMode, 
    ctx: AudioContext, 
    dest: AudioNode, 
    time: number, 
    step: number, 
    fP: number, 
    oP: number, 
    secondsPerStep: number,
    onKickTrigger?: (time: number) => void
) => {
    const sidechain = (step % 4 === 0) ? 0.45 : 1.0; 
    const sf = fP * sidechain;
    const so = oP * sidechain;

    switch (mode) {
        case DecayMode.STABLE:
            if (step % 4 === 0) { createKick(ctx, dest, time, 0.8 * fP); onKickTrigger?.(time); }
            if (step % 4 === 2) createHat(ctx, dest, time, oP, 0.8);
            if (step % 8 === 6) createHat(ctx, dest, time, oP * 1.1, 1.1);
            if (step % 16 === 14) createSynth(ctx, dest, time, 2637, 0.08, 0.2 * so, 'pulse');
            break;
        case DecayMode.BETA_MINUS:
            if (step % 4 === 0) { createKick(ctx, dest, time, 0.85 * fP, 'dnb-punch'); onKickTrigger?.(time); }
            if (step === 12) createSnare(ctx, dest, time, 0.7 * oP, 'industrial');
            if (step % 4 === 2) createHat(ctx, dest, time, oP * 1.2, 1.3);
            if ([3, 7, 11, 15].includes(step)) {
                createSynth(ctx, dest, time, 110, 0.04, 0.6 * so, 'dark');
            }
            if (step % 2 === 0) {
                createSynth(ctx, dest, time, 55, 0.05, 0.4 * sf, 'pulse');
            }
            break;
        case DecayMode.BETA_PLUS:
            if ([0, 3, 6, 9, 13].includes(step)) { createKick(ctx, dest, time, 0.9 * fP); onKickTrigger?.(time); }
            if (step === 4 || step === 12) createSnare(ctx, dest, time, 0.6 * oP, 'sharp');
            if (step % 2 === 1) createHat(ctx, dest, time, oP, 1.1);
            if (step % 16 === 7) createSynth(ctx, dest, time, 880, 0.2, 0.6 * so, 'sparkle');
            break;
        case DecayMode.ELECTRON_CAPTURE:
            if ([1, 4, 7, 10, 14].includes(step)) { createKick(ctx, dest, time, 0.85 * fP, 'dnb-punch'); onKickTrigger?.(time); }
            if (step % 4 === 2 || step === 5 || step === 13) {
                createSynth(ctx, dest, time, 41.2, 0.12, 0.55 * sf, 'pulse');
            }
            const raveSequence = [220, 0, 165, 330, 0, 440, 0, 220, 110, 0, 165, 0, 220, 0, 330, 440];
            if (raveSequence[step] > 0) {
                createSynth(ctx, dest, time, raveSequence[step], 0.06, 0.45 * so, 'acid');
            }
            if (step === 2 || step === 11) createSnare(ctx, dest, time, 0.7 * oP, 'industrial');
            createHat(ctx, dest, time, oP * (step % 2 === 0 ? 0.6 : 1.1), 1.2);
            break;
        case DecayMode.ALPHA:
            if (step === 0 || step === 10) { createKick(ctx, dest, time, 0.95 * fP, 'dnb-punch'); onKickTrigger?.(time); }
            createSynth(ctx, dest, time, step % 8 < 4 ? 41.2 : 38.8, secondsPerStep * 2.5, 0.9 * sf, 'dark');
            if (step === 4 || step === 12) createSnare(ctx, dest, time, 1.0 * oP, 'dnb-crack');
            createHat(ctx, dest, time, oP * (step % 2 === 0 ? 0.9 : 0.5), 1.1);
            if (step % 4 === 1) createSynth(ctx, dest, time, 1760, 0.05, 0.3 * so, 'dnb-lead');
            break;
        case DecayMode.SPONTANEOUS_FISSION:
            if (step % 4 === 0) { createKick(ctx, dest, time, 1.0 * fP, 'dnb-punch'); onKickTrigger?.(time); }
            if (step === 4 || step === 12) createSnare(ctx, dest, time, 1.1 * oP, 'industrial');
            if (step === 15) createSnare(ctx, dest, time, 0.4 * oP, 'sharp');
            if (step % 2 === 0) createHat(ctx, dest, time, oP * 0.6, 0.9);
            if (step % 4 === 2) {
                createSynth(ctx, dest, time, 2637, 0.05, 0.9 * so, 'pulse');
                createSynth(ctx, dest, time, 3520, 0.03, 0.5 * so, 'sparkle');
            }
            const coolBass = [92.5, 92.5, 110, 110, 123.47, 123.47, 110, 82.41, 92.5, 92.5, 110, 110, 123.47, 123.47, 138.59, 164.81];
            createSynth(ctx, dest, time, coolBass[step], secondsPerStep * 0.7, 0.8 * sf, 'dark');
            break;
        case DecayMode.NEUTRON_EMISSION:
            if (step % 4 === 0) { createKick(ctx, dest, time, 1.15 * fP, 'heavy-gabber'); onKickTrigger?.(time); }
            if (step % 4 !== 0) createSynth(ctx, dest, time, 41.2, secondsPerStep * 2, 0.7 * sf, 'dark');
            if (step % 8 === 2 || step % 8 === 6) createSnare(ctx, dest, time, oP * 0.9, 'industrial');
            if (Math.random() > 0.6) createHat(ctx, dest, time, oP, 1.7);
            break;
        case DecayMode.PROTON_EMISSION:
            if (step % 4 === 0) { createKick(ctx, dest, time, 0.95 * fP, 'dnb-punch'); onKickTrigger?.(time); }
            if (step % 4 === 2) createHat(ctx, dest, time, oP * 1.4, 1.3);
            if (step % 2 === 1) createHat(ctx, dest, time, oP * 0.7, 0.9);
            if ([0, 3, 6, 10, 13].includes(step)) createSynth(ctx, dest, time, [1760, 2637, 3520][step % 3], 0.1, 0.4 * so, 'sparkle');
            if (step === 15) for(let i = 0; i < 4; i++) createSynth(ctx, dest, time + (i * 0.025), 3520 + (i * 440), 0.03, 0.16 * so, 'pulse');
            break;
        case DecayMode.UNKNOWN:
            if (step === 0) createSynth(ctx, dest, time, 32.7, secondsPerStep * 24, 0.4 * sf, 'void');
            if (step === 8) createSynth(ctx, dest, time, 38.8, secondsPerStep * 16, 0.3 * sf, 'void');
            const crystalFrequencies = [
                1396.91, 1396.91, 1396.91, 1396.91, 
                1244.51, 1108.73, 1046.50, 932.33,  
                830.61, 783.99, 698.46, 783.99,     
                830.61, 932.33, 1046.50, 1108.73    
            ];
            createSynth(ctx, dest, time, crystalFrequencies[step], 0.25, 0.5 * so, 'sparkle');
            if (step % 4 === 2) {
                createSynth(ctx, dest, time, crystalFrequencies[step] * 2, 0.05, 0.2 * so, 'pulse');
            }
            if (step % 8 === 0) { createKick(ctx, dest, time, 0.4 * fP, 'sharp-gabber'); onKickTrigger?.(time); }
            break;
        default:
            if (step % 4 === 0) { createKick(ctx, dest, time, 0.7 * fP); onKickTrigger?.(time); }
            break;
    }
};