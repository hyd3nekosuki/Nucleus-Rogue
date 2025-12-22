
import { useEffect, useRef } from 'react';
import { NuclideData } from '../types';

export const useTTS = (nuclide: NuclideData, gameOver: boolean) => {
    const prevNuclideNameRef = useRef<string>(nuclide.name);
    const speechOverrideRef = useRef<string | null>(null);
    const fixedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

    // Initialize Voice
    useEffect(() => {
        const loadVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0 && !fixedVoiceRef.current) {
                 fixedVoiceRef.current = 
                       voices.find(v => v.name === 'Google US English') || 
                       voices.find(v => v.name.includes('David')) || 
                       voices.find(v => v.lang === 'en-US' && !v.name.includes('Zira') && !v.name.includes('Female')) ||
                       voices.find(v => v.lang === 'en-US') || null;
            }
        };
        loadVoice();
        window.speechSynthesis.onvoiceschanged = loadVoice;
        return () => { window.speechSynthesis.onvoiceschanged = null; };
    }, []);

    const triggerOverride = (text: string) => {
        speechOverrideRef.current = text;
    };

    useEffect(() => {
        const currentName = nuclide.name;
        
        if (currentName !== prevNuclideNameRef.current) {
            prevNuclideNameRef.current = currentName;
    
            if ('speechSynthesis' in window && !gameOver) {
                window.speechSynthesis.cancel();
    
                let targetVoice = fixedVoiceRef.current;
                if (!targetVoice) {
                     const voices = window.speechSynthesis.getVoices();
                     targetVoice = voices.find(v => v.name === 'Google US English') || 
                           voices.find(v => v.name.includes('David')) || 
                           voices.find(v => v.lang === 'en-US' && !v.name.includes('Zira') && !v.name.includes('Female')) ||
                           voices.find(v => v.lang === 'en-US') || null;
                     if (targetVoice) fixedVoiceRef.current = targetVoice;
                }
    
                if (speechOverrideRef.current) {
                    const eventUtterance = new SpeechSynthesisUtterance(speechOverrideRef.current);
                    if (targetVoice) eventUtterance.voice = targetVoice;
                    eventUtterance.lang = 'en-US';
                    eventUtterance.rate = 1.2;
                    eventUtterance.pitch = 0.7;
                    window.speechSynthesis.speak(eventUtterance);
                    speechOverrideRef.current = null;
                }
    
                let textToSpeak = currentName;
                if (currentName === 'Hydrogen-1') {
                    textToSpeak = 'Hydrogen';
                } else if (currentName === 'Neutron-1') {
                    textToSpeak = 'Neutron';
                } else {
                    const parts = currentName.split('-');
                    if (parts.length === 2) {
                        const name = parts[0];
                        let speakName = name;
                        if (speakName === 'Lead') speakName = 'Led'; 
    
                        const massStr = parts[1];
                        const mass = parseInt(massStr);
                        
                        if (!isNaN(mass) && massStr.length === 3) {
                            const hundreds = massStr[0];
                            const remainder = parseInt(massStr.slice(1));
                            if (remainder === 0) textToSpeak = `${speakName} ${mass}`;
                            else if (remainder < 10) textToSpeak = `${speakName} ${hundreds} oh ${remainder}`;
                            else textToSpeak = `${speakName} ${hundreds} ${remainder}`;
                        } else {
                            textToSpeak = `${speakName} ${massStr}`;
                        }
                    } else {
                         textToSpeak = currentName.replace('-', ' ');
                         if (textToSpeak.includes('Lead')) textToSpeak = textToSpeak.replace('Lead', 'Led');
                    }
                }
                
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                if (targetVoice) utterance.voice = targetVoice;
                utterance.lang = 'en-US'; 
                utterance.rate = 1.2; 
                utterance.pitch = 0.7; 
                
                window.speechSynthesis.speak(utterance);
            }
        }
    }, [nuclide.name, gameOver]);

    return { triggerOverride };
};
