/**
 * System UI & Presentation Types
 * Defines states and structures used purely for the view layer.
 */

export type GameTab = 'history' | 'structure';

export interface UIStateFlags {
  showTable: boolean;
  activeTab: GameTab;
  isVoiceMuted: boolean;
  isSoundTestActive: boolean;
  isLoadError: boolean;
}

export interface TableSelectionContext {
  canTransmute: boolean;
  onSelectElement: (z: number) => void;
}
