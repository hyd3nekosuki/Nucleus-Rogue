import { DecayMode, GameState, HistoryEntry, SavePayload } from '../types';
import { HISTORY_METHODS } from '../constants';
import { TITLES } from '../constants/titles';

// ID mapping for binary serialization
// CAUTION: Index order must be preserved to maintain save code compatibility.
const GROUP_MAP: string[] = [
    TITLES.NON_METAL,           // 0
    TITLES.NOBLE_GAS,           // 1
    TITLES.ALKALI_METAL,        // 2
    TITLES.ALKALINE_EARTH,      // 3
    TITLES.METALLOID,           // 4
    TITLES.HALOGEN,             // 5
    TITLES.TRANSITION,          // 6
    TITLES.POST_TRANSITION,     // 7
    TITLES.LANTHANIDE,          // 8
    TITLES.ACTINIDE,            // 9
    TITLES.PAIR_ANNIHILATION,   // 10
    TITLES.NEUTRONIZATION,      // 11
    TITLES.EXP_REPLICATE,       // 12
    TITLES.NUCLEOSYNTHESIS,     // 13
    TITLES.UNKNOWN,             // 14
    TITLES.TEMPORAL_INVERSION,  // 15
    TITLES.FUSION,              // 16
    TITLES.FISSION,             // 17
    TITLES.ZERO_BARN,           // 18
    TITLES.ELECTRON_SCATTERING, // 19
    TITLES.GLUTTONY,            // 20
    TITLES.DAREDEVIL            // 21
];

const METHOD_MAP = Object.values(HISTORY_METHODS);
const DECAY_MODE_MAP = Object.values(DecayMode);

/**
 * Robust stream-to-buffer utility.
 */
async function consumeStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            chunks.push(value);
            totalLength += value.length;
        }
    }
    
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

/**
 * Gzip compression utility using pipeThrough for reliability
 */
async function compress(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const blob = new Blob([buffer]);
    const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
    const result = await consumeStream(stream as ReadableStream<Uint8Array>);
    return result.buffer;
}

/**
 * Gzip decompression utility with explicit error handling
 */
async function decompress(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    try {
        const blob = new Blob([buffer]);
        const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
        const result = await consumeStream(stream as ReadableStream<Uint8Array>);
        return result.buffer;
    } catch (e) {
        throw new Error("Decompression failed: Invalid GZIP format or corrupted data");
    }
}

/**
 * Packs game state into a compressed binary Base64 string
 */
export const packBinary = async (state: GameState, history: Record<string, HistoryEntry>): Promise<string> => {
    const historyList = Object.values(history);
    
    // Buffer size calculation: 1024 base + (15 bytes per history entry)
    const bufferSize = 1024 + (historyList.length * 15);
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    let offset = 0;

    view.setFloat64(offset, state.score); offset += 8;
    view.setUint32(offset, state.energyPoints); offset += 4;
    view.setUint8(offset++, state.hp);
    view.setUint8(offset++, state.playerLevel);
    view.setUint16(offset, state.reincarnations); offset += 2;
    view.setUint32(offset, state.turn); offset += 4;
    view.setUint8(offset++, state.currentNuclide.z);
    view.setUint16(offset, state.currentNuclide.a); offset += 2;
    view.setUint16(offset, state.maxCombo); offset += 2;
    view.setUint8(offset++, state.magicBarrierCharges);

    const elementBits = new Uint8Array(15);
    state.unlockedElements.forEach(z => {
        if (z >= 0 && z < 120) elementBits[Math.floor(z / 8)] |= (1 << (z % 8));
    });
    for(let i=0; i<15; i++) view.setUint8(offset++, elementBits[i]);

    let groupBits = 0;
    state.unlockedGroups.forEach(g => {
        const idx = GROUP_MAP.indexOf(g);
        if (idx !== -1) groupBits |= (1 << idx);
    });
    view.setUint32(offset, groupBits); offset += 4;

    let disabledBits = 0;
    state.disabledSkills.forEach(s => {
        const idx = GROUP_MAP.indexOf(s);
        if (idx !== -1) disabledBits |= (1 << idx);
    });
    view.setUint32(offset, disabledBits); offset += 4;

    DECAY_MODE_MAP.slice(0, 8).forEach(mode => {
        view.setUint16(offset, state.decayStats[mode] || 0); offset += 2;
    });
    [HISTORY_METHODS.REACTION_NG, HISTORY_METHODS.REACTION_NP, HISTORY_METHODS.REACTION_N2N, HISTORY_METHODS.REACTION_NA, HISTORY_METHODS.REACTION_NF].forEach(r => {
        view.setUint16(offset, state.reactionStats[r] || 0); offset += 2;
    });

    let masteredBits = 0;
    state.masteredDecays.forEach(m => {
        const idx = DECAY_MODE_MAP.indexOf(m);
        if (idx !== -1) masteredBits |= (1 << idx);
    });
    view.setUint32(offset, masteredBits); offset += 4;

    // --- Reincarnation Pool counts (capped at 65535) ---
    view.setUint16(offset, Math.min(65535, state.reincarnationPool.p)); offset += 2;
    view.setUint16(offset, Math.min(65535, state.reincarnationPool.n)); offset += 2;
    view.setUint16(offset, Math.min(65535, state.reincarnationPool.e)); offset += 2;

    view.setUint16(offset, historyList.length); offset += 2;
    historyList.forEach(h => {
        view.setUint8(offset++, h.pz === null ? 255 : h.pz);
        view.setUint16(offset, h.pa || 0); offset += 2;
        view.setUint8(offset++, h.z);
        view.setUint16(offset, h.a); offset += 2;
        const mIdx = METHOD_MAP.indexOf(h.method);
        view.setUint8(offset++, mIdx === -1 ? 255 : mIdx);
        view.setUint32(offset, h.firstTurn); offset += 4;
        view.setUint32(offset, h.lastTurn); offset += 4;
    });

    const packedData = buffer.slice(0, offset);
    const compressedData = await compress(packedData);
    
    // Robust binary to base64 conversion
    const bytes = new Uint8Array(compressedData);
    let binString = "";
    for (let i = 0; i < bytes.length; i++) {
        binString += String.fromCharCode(bytes[i]);
    }
    return btoa(binString);
};

/**
 * Unpacks game state from a compressed binary Base64 string
 */
export const unpackBinary = async (code: string): Promise<Partial<SavePayload> | null> => {
    try {
        let sanitized = code.trim().replace(/[^A-Za-z0-9+/=]/g, '');
        while (sanitized.length % 4 !== 0) sanitized += '=';
        
        const binString = atob(sanitized);
        const bytes = new Uint8Array(binString.length);
        for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
        
        const decompressed = await decompress(bytes.buffer);
        const finalBytes = new Uint8Array(decompressed);

        const view = new DataView(finalBytes.buffer);
        let offset = 0;

        const score = view.getFloat64(offset); offset += 8;
        const energy = view.getUint32(offset); offset += 4;
        const hp = view.getUint8(offset++);
        const level = view.getUint8(offset++);
        const reincarnations = view.getUint16(offset); offset += 2;
        
        const globalTurn = view.getUint32(offset); offset += 4;
        
        const cz = view.getUint8(offset++);
        const ca = view.getUint16(offset); offset += 2;
        const mc = view.getUint16(offset); offset += 2;
        const mb = view.getUint8(offset++);

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
            if (offset + 2 <= view.byteLength) {
                st[mode] = view.getUint16(offset); offset += 2;
            }
        });

        const rs: Record<string, number> = {};
        [HISTORY_METHODS.REACTION_NG, HISTORY_METHODS.REACTION_NP, HISTORY_METHODS.REACTION_N2N, HISTORY_METHODS.REACTION_NA, HISTORY_METHODS.REACTION_NF].forEach(r => {
            if (offset + 2 <= view.byteLength) {
                rs[r] = view.getUint16(offset); offset += 2;
            }
        });

        const mdBits = view.getUint32(offset); offset += 4;
        const md = DECAY_MODE_MAP.filter((_, i) => mdBits & (1 << i)) as DecayMode[];

        // --- Reincarnation Pool counts ---
        const pp = view.getUint16(offset); offset += 2;
        const pn = view.getUint16(offset); offset += 2;
        const pe = view.getUint16(offset); offset += 2;

        const historyLen = view.getUint16(offset); offset += 2;
        const ev: Record<string, string> = {};
        for (let i = 0; i < historyLen; i++) {
            const rpz = view.getUint8(offset++);
            const pz = rpz === 255 ? null : rpz;
            const pa = view.getUint16(offset); offset += 2;
            const z = view.getUint8(offset++);
            const a = view.getUint16(offset); offset += 2;
            const mIdx = view.getUint8(offset++);
            const method = mIdx === 255 ? TITLES.UNKNOWN : (METHOD_MAP[mIdx] || HISTORY_METHODS.TRANSMUTATION);
            
            let firstTurn = 0;
            let lastTurn = 0;
            
            if (offset + 8 <= view.byteLength) {
                firstTurn = view.getUint32(offset); offset += 4;
                lastTurn = view.getUint32(offset); offset += 4;
            } else if (offset + 4 <= view.byteLength) {
                firstTurn = view.getUint32(offset); offset += 4;
                lastTurn = firstTurn;
            }
            
            const key = `${z}-${a}`;
            ev[key] = `${pz === null ? 'null' : pz}:${pa}:${method}:${firstTurn}:${lastTurn}`;
        }

        return { s: score, e: energy, h: hp, l: level, r: reincarnations, t: globalTurn, cz, ca, ue, ug, ds, st, rs, ev, md, mc, mb, pp, pn, pe };
    } catch (e) {
        console.error("Unpack failed:", e instanceof Error ? e.message : String(e));
        return null;
    }
};