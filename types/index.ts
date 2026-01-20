/**
 * Unified Type Export System
 * Centralized barrel that maintains compatibility with the legacy interface
 * while organizing types into Domain, Engine, and System sub-layers.
 */

// Domain Layer (Scientific Facts & Physics Rules)
export * from './domain/nuclide';
export * from './domain/physics';
export * from './domain/entities';
export * from './domain/reactions';

// Engine Layer (Game Logic & State Management)
export * from './engine/history';
export * from './engine/events';
export * from './engine/state';
export * from './engine/persistence';
export * from './engine/simulation';
export * from './engine/progression';
export * from './engine/tutorial';

// System Layer (UI, Audio, and Infrastructure)
export * from './system/ui';    // Added in Step 1-7
export * from './system/audio'; // Added in Step 1-7
