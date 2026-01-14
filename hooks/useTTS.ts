import { useEffect, useRef, useCallback } from 'react';
import { NuclideData } from '../types';
import { TITLES } from '../constants/titles';

export const useTTS = (nuclide: NuclideData, gameOver: boolean, isMuted: boolean) => {
    const prevNuclideNameRef = useRef<string>(nuclide.name);
    const fixedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
    const debounceTimerRef = useRef<number | null>(null);
    
    // Sequence State
    const isSpeakingPriorityRef = useRef<boolean>(false);
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

    const applyNaturalSpeechPatterns = useCallback((text: string) => {
        let p = text;
        // Specific term overrides for natural English pronunciation
        p = p.replace(new RegExp(TITLES.EXP_REPLICATE, 'g'), "Experimental Replication");
        p = p.replace(new RegExp(TITLES.ZERO_BARN, 'g'), "Zero Barn");
        p = p.replace(/β\-/g, "Beta Minus");
        p = p.replace(/β\+/g, "Beta Plus");
        p = p.replace(/α/g, "Alpha");
        p = p.replace(/γ/g, "Gamma");
        return p;
    }, []);

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
            }
        }
        return processed;
    };

    /**
     * speakNuclide: Pronounces the latest nuclide name.
     * Guaranteed to follow an event name if one was just spoken.
     */
    const speakNuclide = useCallback(() => {
        if (!('speechSynthesis' in window) || isMuted || gameOver || !pendingNuclideNameRef.current) {
            isSpeakingPriorityRef.current = false;
            return;
        }

        const text = processNameForSpeech(pendingNuclideNameRef.current);
        pendingNuclideNameRef.current = null;
        
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = getTargetVoice();
        if (voice) utterance.voice = voice;
        utterance.lang = 'en-US';
        utterance.rate = 1.1; 
        utterance.pitch = 0.85;

        // Reset the priority flag once the full sequence (Event + Name) is done
        utterance.onend = () => { isSpeakingPriorityRef.current = false; };
        utterance.onerror = () => { isSpeakingPriorityRef.current = false; };

        window.speechSynthesis.speak(utterance);
    }, [isMuted, gameOver, getTargetVoice]);

    /**
     * triggerOverride: Pronounces Important Event Name (Priority) 
     * then automatically sequences the nuclide name.
     */
    const triggerOverride = useCallback((text: string) => {
        if (!('speechSynthesis' in window) || isMuted || gameOver) return;
        
        // Rule: Latest only - Cancel any current backlog
        window.speechSynthesis.cancel();
        isSpeakingPriorityRef.current = true;

        const utterance = new SpeechSynthesisUtterance(applyNaturalSpeechPatterns(text));
        const voice = getTargetVoice();
        if (voice) utterance.voice = voice;
        utterance.lang = 'en-US';
        utterance.rate = 1.25;
        utterance.pitch = 0.9;
        
        // Implementation of "Important Event Name + Nuclide Name"
        utterance.onend = () => speakNuclide();
        utterance.onerror = () => { 
            isSpeakingPriorityRef.current = false;
            speakNuclide();
        };
        
        window.speechSynthesis.speak(utterance);
    }, [isMuted, gameOver, getTargetVoice, applyNaturalSpeechPatterns, speakNuclide]);

    /**
     * Effect for automatic nuclide name vocalization.
     * Enforces the "latest nuclide only" rule.
     */
    useEffect(() => {
        const currentName = nuclide.name;
        if (currentName === prevNuclideNameRef.current) return;
        prevNuclideNameRef.current = currentName;

        if (isMuted || gameOver) return;

        // Store as latest nuclide
        pendingNuclideNameRef.current = currentName;

        // If a priority event is already managing the sequence, do nothing (it will use the updated ref)
        if (!isSpeakingPriorityRef.current) {
            if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = window.setTimeout(() => {
                // Re-verify flag after debounce to prevent race conditions with triggerOverride
                if (!isSpeakingPriorityRef.current) {
                    // Latest only: Cancel any queue that might have built up
                    window.speechSynthesis.cancel();
                    speakNuclide();
                }
            }, 50);
        }
        
    }, [nuclide.name, isMuted, gameOver, speakNuclide]);

    return { triggerOverride };
};