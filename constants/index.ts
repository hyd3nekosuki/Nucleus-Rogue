/**
 * Barrel file for constants.
 * Maintains backward compatibility while delegating to specialized files.
 */
export * from './gameConfig';
export * from './physics';
export * from './atomicData';
export * from './economy';
export * from './strings';
export * from './periodicTableData';
export * from './gameOverReason';
// Fix: Export titles to resolve 'Module has no exported member TITLES' error in periodicTableUtils.ts
export * from './titles';
export * from './logMessageTextData';
export * from './logMessageTextDataJP';

import { LOG_MESSAGES } from './logMessageTextData';
import { LOG_MESSAGES_JP } from './logMessageTextDataJP';
import { Language } from '../types';

export const getLogMessages = (lang: Language) => {
  return lang === 'jp' ? { ...LOG_MESSAGES_JP } : { ...LOG_MESSAGES };
};
