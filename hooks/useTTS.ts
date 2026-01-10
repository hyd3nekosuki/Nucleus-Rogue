
import { useEffect, useRef, useCallback } from 'react';
import { NuclideData } from '../types';

export const useTTS = (nuclide: NuclideData, gameOver: boolean, isMuted: boolean) => {
    const prevNuclideNameRef = useRef<string>(nuclide.name);
    const fixedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
    const debounceTimerRef = useRef<number | null>(null);
    // Track if a priority event (e.g. Fusion) is currently speaking
    const isPriorityActiveRef = useRef<boolean>(false);

    const getTargetVoice = useCallback(() => {
        if (fixedVoiceRef.current) return fixedVoiceRef.current;
        const voices = window.speechSynthesis.getVoices();
        const target = voices.find(v => v.name === 'Google US English') || 
                     voices.find(v => v.name.includes('David')) || 
                     voices.find(v => v.lang === 'en-US' && !v.name.includes('Zira') && !v.name.includes('Female')) ||
                     voices.find(v => v.lang === 'en-US');
        if (target) fixedVoiceRef.current = target;
        return target || null;
    }, []);

    useEffect(() => {
        const loadVoice = () => getTargetVoice();
        loadVoice();
        window.speechSynthesis.onvoiceschanged = loadVoice;
        return () => { window.speechSynthesis.onvoiceschanged = null; };
    }, [getTargetVoice]);

    const createUtterance = useCallback((text: string) => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = getTargetVoice();
        if (voice) utterance.voice = voice;
        utterance.lang = 'en-US';
        utterance.rate = 1.2;
        utterance.pitch = 0.9;
        return utterance;
    }, [getTargetVoice]);

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
     * triggerOverride: IMPORTANT EVENTS
     * These interrupt everything and must be heard.
     */
    const triggerOverride = useCallback((text: string) => {
        if (!('speechSynthesis' in window) || isMuted || gameOver) return;
        
        // 1. Immediately stop current speech (usually old nuclide names)
        window.speechSynthesis.cancel();
        
        // 2. Set priority flag
        isPriorityActiveRef.current = true;

        if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        const utterance = createUtterance(text);
        
        // 3. Reset flag when this specific important message finishes
        utterance.onend = () => {
            isPriorityActiveRef.current = false;
        };
        utterance.onerror = () => {
            isPriorityActiveRef.current = false;
        };

        window.speechSynthesis.speak(utterance);
    }, [isMuted, gameOver, createUtterance]);

    /**
     * useEffect: NUCLIDE NAME (DEBOUNCED)
     * Announced after 200ms of stillness.
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
            // ONLY cancel if a priority message is NOT playing.
            // This clears "stale" nuclide names from the browser queue if the user moved/stopped multiple times.
            if (!isPriorityActiveRef.current) {
                window.speechSynthesis.cancel();
            }

            const textToSpeak = processNameForSpeech(currentName);
            const utterance = createUtterance(textToSpeak);
            
            // If priority is active, this simply joins the queue and plays AFTER the priority message.
            // Since it's debounced, only the LAST nuclide name reached this point.
            window.speechSynthesis.speak(utterance);
            debounceTimerRef.current = null;
        }, 200);

        return () => {
            if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
        };
    }, [nuclide.name, isMuted, gameOver, createUtterance]);

    return { triggerOverride };
};
