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
      // 1. Guard: Prevent default scrolling, search or browser shortcuts for game keys
      // Includes digits for Numpad support and Rogue 'wait' period
      const scrollPreventKeys = [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
        ' ', 'Spacebar', '.',
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
        'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 
        'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9',
        'Home', 'End', 'PageUp', 'PageDown', 'Clear'
      ];
      if (scrollPreventKeys.includes(e.key)) {
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
        // --- Orthogonal Movement (Rogue: hjkl + Arrows + Numpad) ---
        case 'k':
        case 'ArrowUp': 
        case '8':
        case 'Numpad8':
          engine.moveStep(0, -1); 
          break;
        case 'j':
        case 'ArrowDown': 
        case '2':
        case 'Numpad2':
          engine.moveStep(0, 1); 
          break;
        case 'h':
        case 'ArrowLeft': 
        case '4':
        case 'Numpad4':
          engine.moveStep(-1, 0); 
          break;
        case 'l':
        case 'ArrowRight': 
        case '6':
        case 'Numpad6':
          engine.moveStep(1, 0); 
          break;

        // --- Diagonal Movement (Rogue: yubn + Numpad) ---
        case 'y':
        case '7':
        case 'Numpad7':
        case 'Home':
          engine.moveStep(-1, -1);
          break;
        case 'u':
        case '9':
        case 'Numpad9':
        case 'PageUp':
          engine.moveStep(1, -1);
          break;
        case 'b':
        case '1':
        case 'Numpad1':
        case 'End':
          engine.moveStep(-1, 1);
          break;
        case 'n':
        case '3':
        case 'Numpad3':
        case 'PageDown':
          engine.moveStep(1, 1);
          break;

        // --- Wait / Stay in place (Rogue: s, ., Numpad 5) ---
        // WASD 's' is now correctly mapped to 'Wait' as per Rogue standard.
        // 'Clear' is the key name for Numpad5 when NumLock is OFF on some systems.
        case 's':
        case '.':
        case '5':
        case 'Numpad5':
        case 'Clear':
          engine.moveStep(0, 0);
          break;

        // --- Core Interaction (Decay / Transformation) ---
        case 'Enter': 
        case ' ': 
        case 'Spacebar': 
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