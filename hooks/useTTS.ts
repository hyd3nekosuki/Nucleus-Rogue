import { useEffect, useRef, useCallback } from 'react';
import { NuclideData } from '../types';
import { TITLES } from '../constants/titles';

export const useTTS = (nuclide: NuclideData, gameOver: boolean, isMuted: boolean) => {
    const prevNuclideNameRef = useRef<string>(nuclide.name);
    const fixedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
    const debounceTimerRef = useRef<number | null>(null);
    
    // Prevent garbage collection of the utterance objects by keeping them in a ref
    const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    
    // Track if a priority event (e.g. Fusion, Mastery Level Up) is currently speaking
    const isPriorityActiveRef = useRef<boolean>(false);
    // Provisional registration for the nuclide name to be spoken after priority event ends
    const pendingNuclideNameRef = useRef<string | null>(null);

    const getTargetVoice = useCallback(() => {
        if (fixedVoiceRef.current) return fixedVoiceRef.current;
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return null;

        const target = voices.find(v => v.name === 'Google US English') || 
                     voices.find(v => v.name.includes('David')) || 
                     voices.find(v => v.lang === 'en-US' && !v.name.includes('Zira') && !v.name.includes('Female')) ||
                     voices.find(v => v.lang === 'en-US');
        
        if (target) fixedVoiceRef.current = target;
        return target || null;
    }, []);

    useEffect(() => {
        const loadVoice = () => getTargetVoice();
        if ('speechSynthesis' in window) {
            loadVoice();
            window.speechSynthesis.onvoiceschanged = loadVoice;
        }
        return () => { 
            if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = null; 
        };
    }, [getTargetVoice]);

    /**
     * applyNaturalSpeechPatterns: 
     * Converts technical titles and scientific symbols into natural English for TTS.
     */
    const applyNaturalSpeechPatterns = useCallback((text: string) => {
        let p = text;
        
        // 1. Explicit Title Transformations
        // Use TITLES constant to ensure match, but replace with full natural wording
        p = p.replace(new RegExp(TITLES.EXP_REPLICATE, 'g'), "Experimental Replicate");
        p = p.replace(new RegExp(TITLES.ZERO_BARN, 'g'), "Zero Barn");
        
        // 2. Scientific Symbol Conversions (Ensures accessibility across all OS voices)
        p = p.replace(/β\-/g, "Beta Minus");
        p = p.replace(/β\+/g, "Beta Plus");
        p = p.replace(/α/g, "Alpha");
        p = p.replace(/γ/g, "Gamma");
        
        return p;
    }, []);

    const createUtterance = useCallback((text: string) => {
        // Apply natural speech translations before creating the utterance
        const processedText = applyNaturalSpeechPatterns(text);
        const utterance = new SpeechSynthesisUtterance(processedText);
        
        const voice = getTargetVoice();
        if (voice) utterance.voice = voice;
        utterance.lang = 'en-US';
        utterance.rate = 1.2;
        utterance.pitch = 0.9;
        return utterance;
    }, [getTargetVoice, applyNaturalSpeechPatterns]);

    const processNameForSpeech = (name: string) => {
        if (name === 'Hydrogen-1') return 'Hydrogen';
        if (name === 'Neutron-1') return 'Neutron';
        
        let processed = name.replace('-', ' ');
        if (processed.includes('Lead')) processed = processed.replace('Lead', 'Led');
        
        const parts = name.split('-');
        if (parts.length === 2) {
            const massStr = parts[1];
            const mass = parseInt(massStr);
            if (!isNaN(mass) && massStr.length === 3) {
                const hundreds = massStr[0];
                const remainder = parseInt(massStr.slice(1));
                if (remainder === 0) return `${parts[0]} ${mass}`;
                if (remainder < 10) return `${parts[0]} ${hundreds} oh ${remainder}`;
                return processed;
            }
        }
        return processed;
    };

    /**
     * speakPending: Announces the provisionally registered nuclide name.
     */
    const speakPending = useCallback(() => {
        if (pendingNuclideNameRef.current) {
            const textToSpeak = processNameForSpeech(pendingNuclideNameRef.current);
            const utterance = createUtterance(textToSpeak);
            currentUtteranceRef.current = utterance;
            window.speechSynthesis.speak(utterance);
            pendingNuclideNameRef.current = null;
        }
    }, [createUtterance]);

    /**
     * triggerOverride: IMPORTANT EVENTS (Mastery Level Up, etc.)
     * These interrupt everything and lock the speech engine until finished.
     */
    const triggerOverride = useCallback((text: string) => {
        if (!('speechSynthesis' in window) || isMuted || gameOver) return;
        
        // 1. Force cancel everything to clear the path for the priority message
        window.speechSynthesis.cancel();
        
        // 2. Stop any pending nuclide name timers
        if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        // 3. Mark as priority - this prevents useEffect from interrupting this message
        isPriorityActiveRef.current = true;

        const utterance = createUtterance(text);
        currentUtteranceRef.current = utterance;
        
        const handleEnd = (e?: SpeechSynthesisEvent | SpeechSynthesisErrorEvent) => {
            if (currentUtteranceRef.current === utterance) {
                isPriorityActiveRef.current = false;
                currentUtteranceRef.current = null;
                // Important: Speak the nuclide name that was "parked" during this message
                speakPending();
            }
        };

        utterance.onend = handleEnd;
        utterance.onerror = (e) => {
            if (e.error !== 'interrupted' && e.error !== 'canceled') {
                console.warn(`TTS Warning: Priority speech "${text}" result:`, e.error);
            }
            handleEnd();
        };

        // Short delay to let the engine settle after cancel()
        window.setTimeout(() => {
            window.speechSynthesis.speak(utterance);
        }, 50);
        
    }, [isMuted, gameOver, createUtterance, speakPending]);

    /**
     * useEffect: NUCLIDE NAME (DEBOUNCED)
     * Handles nuclide name announcements with override logic.
     */
    useEffect(() => {
        const currentName = nuclide.name;
        if (currentName === prevNuclideNameRef.current) return;
        prevNuclideNameRef.current = currentName;

        if (!('speechSynthesis' in window) || isMuted || gameOver) {
            if (isMuted) window.speechSynthesis.cancel();
            return;
        }

        if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = window.setTimeout(() => {
            // IF a priority message is active, we NEVER interrupt it.
            // We just update the pending buffer so it speaks the LATEST name when priority ends.
            if (isPriorityActiveRef.current) {
                pendingNuclideNameRef.current = currentName;
                debounceTimerRef.current = null;
                return;
            }

            // IF no priority is active, we WANT to interrupt any current speech.
            // (Whatever is currently speaking must be an older nuclide name)
            window.speechSynthesis.cancel();
            pendingNuclideNameRef.current = null; // We are speaking it now
            
            const textToSpeak = processNameForSpeech(currentName);
            const utterance = createUtterance(textToSpeak);
            currentUtteranceRef.current = utterance;
            
            window.speechSynthesis.speak(utterance);
            debounceTimerRef.current = null;
        }, 200);

        return () => {
            if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
        };
    }, [nuclide.name, isMuted, gameOver, createUtterance]);

    return { triggerOverride };
};