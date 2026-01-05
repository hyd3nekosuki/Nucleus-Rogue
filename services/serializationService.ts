import { DecayMode, GameState, HistoryEntry, SavePayload } from '../types';

// IDマッピング定義（バイナリ化のため順序を固定）
const GROUP_MAP = [
    "Non-metal", "Noble Gas", "Alkali Metal", "Alkaline Earth", "Metalloid", "Halogen", 
    "Transition", "Post-Transition", "Lanthanide", "Actinide", "Pair annihilation", 
    "Neutronization", "Exp. Replicate", "Nucleosynthesis", "Unknown", 
    "Temporal Inversion", "Fusion", "Fission", "zero barn", "Electron scattering", "Gluttony"
];

const METHOD_MAP = [
    "Origin", "Transmutation", "fusion", "Positron capture", "Proton Capture", 
    "Neutron Capture", "Electron Capture", "Induced α decay", "Induced β- decay", 
    "Induced β+ decay", "Induced spontaneous fission", "Neutron-induced fission", 
    "Nucleosynthesis", "r-process nucleosynthesis", "Experimental Replicate", 
    "Induced Electron capture", "Induced Proton emission", "Induced Neutron emission", 
    "Induced Gamma decay", "Gamma decay"
];

const DECAY_MODE_MAP = Object.values(DecayMode);

/**
 * 圧縮ユーティリティ
 */
async function compress(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new Response(buffer).body!.pipeThrough(new CompressionStream("gzip"));
    return await new Response(stream).arrayBuffer();
}

/**
 * 解凍ユーティリティ
 */
async function decompress(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new Response(buffer).body!.pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).arrayBuffer();
}

/**
 * データをバイナリ形式にパックし、Gzip圧縮してBase64で返す
 */
export const packBinary = async (state: GameState, history: HistoryEntry[]): Promise<string> => {
    const historyEntries = history.map(h => {
        return { key: `${h.z}-${h.a}`, z: h.z, a: h.a, m: h.method };
    });
    const uniqueHistory = Array.from(new Map(historyEntries.map(item => [item.key, item])).values());
    
    // バッファの確保
    const bufferSize = 132 + (uniqueHistory.length * 4);
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    let offset = 0;

    // [State]
    view.setFloat64(offset, state.score); offset += 8;
    view.setUint32(offset, state.energyPoints); offset += 4;
    view.setUint8(offset++, state.hp);
    view.setUint8(offset++, state.playerLevel);
    view.setUint16(offset, state.reincarnations); offset += 2;
    view.setUint8(offset++, state.currentNuclide.z);
    view.setUint16(offset, state.currentNuclide.a); offset += 2;

    // [Bitsets] 解放元素 (Z=0~119) -> 15 bytes
    const elementBits = new Uint8Array(15);
    state.unlockedElements.forEach(z => {
        if (z >= 0 && z < 120) elementBits[Math.floor(z / 8)] |= (1 << (z % 8));
    });
    for(let i=0; i<15; i++) view.setUint8(offset++, elementBits[i]);

    // [Bitsets] 解放グループ -> 4 bytes
    let groupBits = 0;
    state.unlockedGroups.forEach(g => {
        const idx = GROUP_MAP.indexOf(g);
        if (idx !== -1) groupBits |= (1 << idx);
    });
    view.setUint32(offset, groupBits); offset += 4;

    // [Bitsets] 無効化スキル -> 4 bytes
    let disabledBits = 0;
    state.disabledSkills.forEach(s => {
        const idx = GROUP_MAP.indexOf(s);
        if (idx !== -1) disabledBits |= (1 << idx);
    });
    view.setUint32(offset, disabledBits); offset += 4;

    // [Stats]
    DECAY_MODE_MAP.slice(0, 8).forEach(mode => {
        view.setUint16(offset, state.decayStats[mode] || 0); offset += 2;
    });
    ["(n,γ)", "(n,p)", "(n,2n)", "(n,α)", "(n,fission)"].forEach(r => {
        view.setUint16(offset, state.reactionStats[r] || 0); offset += 2;
    });

    // [Bitsets] マスター済み崩壊モード -> 4 bytes
    let masteredBits = 0;
    state.masteredDecays.forEach(m => {
        const idx = DECAY_MODE_MAP.indexOf(m);
        if (idx !== -1) masteredBits |= (1 << idx);
    });
    view.setUint32(offset, masteredBits); offset += 4;

    // [History]
    view.setUint16(offset, uniqueHistory.length); offset += 2;
    uniqueHistory.forEach(h => {
        view.setUint8(offset++, h.z);
        view.setUint16(offset, h.a); offset += 2;
        const mIdx = METHOD_MAP.indexOf(h.m);
        view.setUint8(offset++, mIdx === -1 ? 255 : mIdx);
    });

    // 圧縮とBase64化
    const packedData = buffer.slice(0, offset);
    const compressedData = await compress(packedData);
    
    let binString = "";
    const bytes = new Uint8Array(compressedData);
    for (let i = 0; i < bytes.length; i++) {
        binString += String.fromCharCode(bytes[i]);
    }
    return btoa(binString);
};

/**
 * Base64をデコード、解凍、アンパックしてPayloadに変換する
 */
export const unpackBinary = async (code: string): Promise<Partial<SavePayload> | null> => {
    try {
        let sanitized = code.trim().replace(/[^A-Za-z0-9+/=]/g, '');
        while (sanitized.length % 4 !== 0) sanitized += '=';
        
        const binString = atob(sanitized);
        const bytes = new Uint8Array(binString.length);
        for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
        
        // 解凍 (Gzip形式を想定)
        const decompressed = await decompress(bytes.buffer);
        const finalBytes = new Uint8Array(decompressed);

        const view = new DataView(finalBytes.buffer);
        let offset = 0;

        const score = view.getFloat64(offset); offset += 8;
        const energy = view.getUint32(offset); offset += 4;
        const hp = view.getUint8(offset++);
        const level = view.getUint8(offset++);
        const reincarnations = view.getUint16(offset); offset += 2;
        const cz = view.getUint8(offset++);
        const ca = view.getUint16(offset); offset += 2;

        const ue: number[] = [];
        for (let i = 0; i < 15; i++) {
            const byte = view.getUint8(offset++);
            for (let bit = 0; bit < 8; bit++) {
                if (byte & (1 << bit)) ue.push(i * 8 + bit);
            }
        }

        const ugBits = view.getUint32(offset); offset += 4;
        const ug = GROUP_MAP.filter((_, i) => ugBits & (1 << i));

        const dsBits = view.getUint32(offset); offset += 4;
        const ds = GROUP_MAP.filter((_, i) => dsBits & (1 << i));

        const st: Record<string, number> = {};
        DECAY_MODE_MAP.slice(0, 8).forEach(mode => {
            st[mode] = view.getUint16(offset); offset += 2;
        });

        const rs: Record<string, number> = {};
        ["(n,γ)", "(n,p)", "(n,2n)", "(n,α)", "(n,fission)"].forEach(r => {
            rs[r] = view.getUint16(offset); offset += 2;
        });

        const mdBits = view.getUint32(offset); offset += 4;
        const md = DECAY_MODE_MAP.filter((_, i) => mdBits & (1 << i));

        const historyLen = view.getUint16(offset); offset += 2;
        const ev: Record<string, string> = {};
        for (let i = 0; i < historyLen; i++) {
            const z = view.getUint8(offset++);
            const a = view.getUint16(offset); offset += 2;
            const mIdx = view.getUint8(offset++);
            const method = mIdx === 255 ? "Unknown" : (METHOD_MAP[mIdx] || "Transmutation");
            ev[`${z}-${a}`] = method;
        }

        return { s: score, e: energy, h: hp, l: level, r: reincarnations, cz, ca, ue, ug, ds, st, rs, ev, md };
    } catch (e) {
        console.error("Unpack failed", e);
        return null;
    }
};
