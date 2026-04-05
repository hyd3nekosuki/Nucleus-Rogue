
import React from 'react';
import { REASON } from '../constants/gameOverReason';

import { Language } from '../types';

/**
 * Visual configuration for various game ending conditions.
 */
export const REASON_METADATA: Record<string, { title: (lang: Language) => string; getDescription: (name: string, lang: Language) => React.ReactNode }> = {
    [REASON.FATAL_CAPTURE]: {
        title: (lang) => lang === 'jp' ? "致命的な捕獲" : "FATAL CAPTURE",
        getDescription: (name, lang) => lang === 'jp' ? 
            <>安定性が低い状態で<span className="font-bold text-neon-red">致命的な捕獲</span>が発生しました。</> :
            <>Fatal capture occurred at <span className="font-bold text-neon-red">low stability</span>.</>
    },
    [REASON.DECAY_FAILED]: {
        title: (lang) => lang === 'jp' ? "壊変失敗" : "DECAY FAILED",
        getDescription: (name, lang) => lang === 'jp' ?
            <><span className="font-bold text-neon-blue">{name}</span> は存在する娘核種に壊変できませんでした。</> :
            <><span className="font-bold text-neon-blue">{name}</span> fails to decay into an existing descendant nuclide.</>
    },
    [REASON.TRANSFORMATION_FAILED]: {
        title: (lang) => lang === 'jp' ? "核変換失敗" : "TRANSFORMATION FAILED",
        getDescription: (name, lang) => lang === 'jp' ?
            <><span className="font-bold text-neon-blue">{name}</span> は存在する娘核種に核変換できませんでした。</> :
            <><span className="font-bold text-neon-blue">{name}</span> fails to transform into an existing descendant nuclide.</>
    },
    [REASON.NUCLEUS_COLLAPSE]: {
        title: (lang) => lang === 'jp' ? "原子核崩壊" : "NUCLEUS COLLAPSE",
        getDescription: (name, lang) => lang === 'jp' ?
            <>集積が<span className="font-bold text-neon-blue">不可能な構成</span>に達しました。</> :
            <>Accretion reached an <span className="font-bold text-neon-blue">impossible configuration</span>.</>
    },
    [REASON.NOTHINGNESS]: {
        title: (lang) => lang === 'jp' ? "完全対消滅" : "TOTAL ANNIHILATION",
        getDescription: (name, lang) => lang === 'jp' ?
            <>核種と反核種が衝突しました。核種は<span className="font-bold text-neon-purple animate-pulse">純粋な放射線</span>に還元されました。</> :
            <>Your nuclide and anti-nuclide collided. Nuclide was reduced to <span className="font-bold text-neon-purple animate-pulse">pure radiation</span>.</>
    },
    [REASON.ANNIHILATION]: {
        title: (lang) => lang === 'jp' ? "対消滅" : "PAIR ANNIHILATION",
        getDescription: (name, lang) => lang === 'jp' ?
            <>電子と陽電子が衝突しました。電子は<span className="font-bold text-neon-purple animate-pulse">純粋な放射線</span>に還元されました。</> :
            <>Electron and positron collided. Electron was reduced to <span className="font-bold text-neon-purple animate-pulse">pure radiation</span>.</>
    },
    [REASON.ELECTRON_ANNIHILATION]: {
        title: (lang) => lang === 'jp' ? "対消滅 (e-)" : "PAIR ANNIHILATION (e-)",
        getDescription: (name, lang) => lang === 'jp' ?
            <>自機（電子）が陽電子と衝突しました。電子は<span className="font-bold text-neon-purple animate-pulse">純粋な放射線</span>へと変換されました。</> :
            <>Your electron collided with a positron. It was reduced to <span className="font-bold text-neon-purple animate-pulse">pure radiation</span>.</>
    },
    [REASON.POSITRON_ANNIHILATION]: {
        title: (lang) => lang === 'jp' ? "対消滅 (e+)" : "PAIR ANNIHILATION (e+)",
        getDescription: (name, lang) => lang === 'jp' ?
            <>自機（陽電子）が電子と衝突しました。陽電子は<span className="font-bold text-neon-purple animate-pulse">純粋な放射線</span>へと変換されました。</> :
            <>Your positron collided with an electron. It was reduced to <span className="font-bold text-neon-purple animate-pulse">pure radiation</span>.</>
    },
    [REASON.UNKNOWN]: {
        title: (lang) => lang === 'jp' ? "不明" : "UNKNOWN",
        getDescription: (name, lang) => lang === 'jp' ?
            <>あなたは <span className="font-bold text-neon-blue">{name}</span> でした</> :
            <>You were <span className="font-bold text-neon-blue">{name}</span></>
    },
    "DEFAULT": {
        title: (lang) => lang === 'jp' ? "放射性壊変" : "RADIOACTIVE DECAY",
        getDescription: (name, lang) => lang === 'jp' ?
            <>あなたは <span className="font-bold text-neon-blue">{name}</span> でした</> :
            <>You were <span className="font-bold text-neon-blue">{name}</span></>
    }
};
