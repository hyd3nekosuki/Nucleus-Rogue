import { useEffect, useRef, useState } from 'react';
import { DecayMode } from '../types';

export const useAudioEngine = (hp: number, isGameOver: boolean, decayModes: DecayMode[]) => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const nextNoteTimeRef = useRef(0);
    const currentStepRef = useRef(0);
    const timerIDRef = useRef<number | null>(null);

    // Get primary decay mode for musical influence (Dynamically updated after nuclide state change)
    const primaryMode = decayModes.find(m => m !== DecayMode.STABLE && m !== DecayMode.UNKNOWN) 
                       || (decayModes.includes(DecayMode.UNKNOWN) ? DecayMode.UNKNOWN : DecayMode.STABLE);

    const bpm = 122 + (1 - hp / 100) * 33;
    const secondsPerStep = 60 / bpm / 4;

    // --- specialized Synthesis Routines ---

    const createKick = (ctx: AudioContext, time: number, isAlpha: boolean) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const startFreq = isAlpha ? 160 : 110;
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + (isAlpha ? 0.25 : 0.15));
        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + (isAlpha ? 0.25 : 0.15));
        osc.start(time);
        osc.stop(time + 0.3);
    };

    // Beta Plus Shimmer (Light, Ethereal)
    const createPositronShimmer = (ctx: AudioContext, time: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000 + Math.random() * 1000, time);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.03, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.start(time);
        osc.stop(time + 0.1);
    };

    // Electron Capture Pop (Mechanical, Mid-range)
    const createEcPop = (ctx: AudioContext, time: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, time);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, time);
        filter.Q.setValueAtTime(10, time);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.start(time);
        osc.stop(time + 0.05);
    };

    // Neutron Emission Thud (Heavy, Mass-carrying)
    const createNeutronThud = (ctx: AudioContext, time: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        osc.start(time);
        osc.stop(time + 0.2);
    };

    // Proton Emission Spark (High-energy, Sharp)
    const createProtonSpark = (ctx: AudioContext, time: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(3000, time);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.04, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        osc.start(time);
        osc.stop(time + 0.03);
    };

    const createBetaPulse = (ctx: AudioContext, time: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, time);
        osc.frequency.exponentialRampToValueAtTime(400, time + 0.04);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1500, time);
        filter.Q.setValueAtTime(10, time);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.06, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        osc.start(time);
        osc.stop(time + 0.04);
    };

    const scheduler = () => {
        if (!audioCtxRef.current) return;
        while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.1) {
            const time = nextNoteTimeRef.current;
            const step = currentStepRef.current;

            // --- Dynamic Pattern Switch (Determined after nuclide change) ---
            const isAlpha = primaryMode === DecayMode.ALPHA;
            const isBetaMinus = primaryMode === DecayMode.BETA_MINUS;
            const isBetaPlus = primaryMode === DecayMode.BETA_PLUS;
            const isEC = primaryMode === DecayMode.ELECTRON_CAPTURE;
            const isNeutron = primaryMode === DecayMode.NEUTRON_EMISSION;
            const isProton = primaryMode === DecayMode.PROTON_EMISSION;
            const isFission = primaryMode === DecayMode.SPONTANEOUS_FISSION;

            // 1. Kick (Foundation)
            if (step % 4 === 0) createKick(audioCtxRef.current, time, isAlpha);
            
            // 2. Neutron Thud (Head of the bar, heavy)
            if (isNeutron && step === 0) createNeutronThud(audioCtxRef.current, time);

            // 3. Proton Spark (Off-beat accents)
            if (isProton && (step === 3 || step === 11)) createProtonSpark(audioCtxRef.current, time);

            // 4. Beta Minus Pulse
            if (isBetaMinus && step % 4 === 2) createBetaPulse(audioCtxRef.current, time);

            // 5. Beta Plus Shimmer (Continuous high-freq decoration)
            if (isBetaPlus && step % 2 === 1) createPositronShimmer(audioCtxRef.current, time);

            // 6. EC Pop (Steady mechanical clicks)
            if (isEC && (step === 4 || step === 12)) createEcPop(audioCtxRef.current, time);

            // 7. Fission Glitch (Aggressive randomized chaos)
            if (isFission && Math.random() > 0.6) {
                const osc = audioCtxRef.current.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(Math.random() * 100, time);
                const g = audioCtxRef.current.createGain();
                osc.connect(g); g.connect(audioCtxRef.current.destination);
                g.gain.setValueAtTime(0.05, time);
                g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
                osc.start(time); osc.stop(time + 0.05);
            }

            // 8. Bassline (Classic Dark Techno)
            const osc = audioCtxRef.current.createOscillator();
            const gain = audioCtxRef.current.createGain();
            const filter = audioCtxRef.current.createBiquadFilter();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(55, time); // A1
            const filterFreq = 150 + (1 - hp/100) * 800;
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(filterFreq, time);
            filter.Q.setValueAtTime(4, time);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtxRef.current.destination);
            const isBassNote = step % 4 !== 0;
            gain.gain.setValueAtTime(isBassNote ? 0.07 : 0, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + secondsPerStep * 0.7);
            osc.start(time);
            osc.stop(time + secondsPerStep * 0.7);

            nextNoteTimeRef.current += secondsPerStep;
            currentStepRef.current = (currentStepRef.current + 1) % 16;
        }
        timerIDRef.current = window.setTimeout(scheduler, 25);
    };

    const toggleMute = () => {
        if (isMuted) {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }
            nextNoteTimeRef.current = audioCtxRef.current.currentTime;
            scheduler();
            setIsMuted(false);
        } else {
            if (timerIDRef.current) clearTimeout(timerIDRef.current);
            setIsMuted(true);
        }
    };

    useEffect(() => {
        if (isGameOver && !isMuted) {
            if (timerIDRef.current) clearTimeout(timerIDRef.current);
            setIsMuted(true);
        }
    }, [isGameOver, isMuted]);

    return { isMuted, toggleMute, bpm: Math.round(bpm), primaryMode };
};