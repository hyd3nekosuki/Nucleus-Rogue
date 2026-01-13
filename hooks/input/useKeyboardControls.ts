
import { useEffect } from 'react';
import { useNucleusCoordinator } from '../../engine/useNucleusCoordinator';
import { useGameUIState } from '../ui/useGameUIState';

/**
 * Hook to handle global keyboard inputs for the game.
 * Maps physical keys to engine actions and UI state changes.
 */
export const useKeyboardControls = (
  engine: ReturnType<typeof useNucleusCoordinator>,
  ui: ReturnType<typeof useGameUIState>,
  toggleMute: () => void
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Guard: Prevent default scrolling behavior for game keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
        }
      }

      // 2. Guard: Disable controls when typing in input fields (Cheat engine / Cite Research)
      if (document.activeElement?.tagName === 'INPUT') return;

      // 3. User intentional action stops any ongoing automatic movement (Pathfinding)
      engine.stopAutoMove();

      // 4. Input Mapping to Logic
      switch(e.key) {
        // --- Movement (WASD + Arrows) ---
        case 'ArrowUp': 
        case 'w': 
          engine.moveStep(0, -1); 
          break;
        case 'ArrowDown': 
        case 's': 
          engine.moveStep(0, 1); 
          break;
        case 'ArrowLeft': 
        case 'a': 
          engine.moveStep(-1, 0); 
          break;
        case 'ArrowRight': 
        case 'd': 
          engine.moveStep(1, 0); 
          break;

        // --- Core Interaction (Decay / Transformation) ---
        case 'Enter': 
        case ' ': 
        case 'Spacebar': 
          // CRITICAL: Triggers engine with manual decay flag preserved
          engine.handlePlayerInteract(); 
          break;

        // --- Audio & System ---
        case 'm': 
          toggleMute(); 
          break;
        case 'v': 
          ui.toggleVoiceMute(); 
          break;
        case 'Escape': 
          if (ui.isSoundTestActive) ui.closeSoundTest(); 
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine, ui, toggleMute]);
};
