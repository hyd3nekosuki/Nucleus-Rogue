import { LOG_MESSAGES } from '../constants/logMessageTextData';
import { LOG_MESSAGES_JP } from '../constants/logMessageTextDataJP';
import { Language } from '../types';

/**
 * Utility to handle localized log messages.
 * If a message is a JSON string containing a key and params, it translates it.
 * Otherwise, it returns the message as is.
 */
export const getLocalizedLogMessage = (msg: string, language: Language): string => {
  if (msg.startsWith('{')) {
    try {
      const data = JSON.parse(msg);
      if (data.key) {
        const messages: any = language === 'jp' ? LOG_MESSAGES_JP : LOG_MESSAGES;
        const keys = data.key.split('.');
        let template: any = messages;
        
        for (const k of keys) {
          if (template && template[k]) {
            template = template[k];
          } else {
            template = null;
            break;
          }
        }

        if (template) {
          const params = (data.params || []).map((p: any) => 
            typeof p === 'string' ? getLocalizedLogMessage(p, language) : p
          );
          
          if (typeof template === 'function') {
            return template(...params);
          } else if (typeof template === 'string') {
            return template;
          }
        }
      }
    } catch (e) {
      // Fallback to original string
    }
  }
  return msg;
};

/**
 * Always returns the English version of a potentially localized message.
 * Used for TTS and History to maintain English consistency.
 */
export const getEnglishLogMessage = (msg: string): string => {
  return getLocalizedLogMessage(msg, 'en');
};
