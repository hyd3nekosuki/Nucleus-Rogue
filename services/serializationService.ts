import { DecayMode, GameState, HistoryEntry, SavePayload, SaveSectionId } from '../types';
import { HISTORY_METHODS } from '../constants';
import { TITLES } from '../constants/titles';
import { BASE_MASTERY_MODES } from '../utils/masteryUtils';
import { APP_VERSION } from '../constants/gameConfig';

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
    TITLES.DEMON_CORE,           // 21
    TITLES.REAL_PHYSICS          // 22
];

const METHOD_MAP = Object.values(HISTORY_METHODS);
const DECAY_MODE_MAP = Object.values(DecayMode);

const ACHIEVEMENT_MAP: string[] = [
    'reincarnated',
    'combo_master',
    'alpha_master',
    'beta_master',
    'seasoned_nuclide',
    'oganesson',
    'all_elements',
    'forbidden_capture'
];

// Achievement-critical stats that need to be persisted
const EXTENDED_DECAY_STATS = [
    'PURE_ALPHA',
    'PURE_BETA_MINUS',
    DecayMode.DOUBLE_BETA_MINUS,
    DecayMode.B_MINUS_N,
    DecayMode.B_MINUS_ALPHA,
    DecayMode.B_MINUS_PROTON,
    DecayMode.B_MINUS_SF,
    DecayMode.B_PLUS_ALPHA,
    DecayMode.EC_ALPHA
];

const EXTENDED_REACTION_STATS = [
    HISTORY_METHODS.REACTION_PA
];

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
 * Packs game state into a compressed binary Base64 string using a section-based format
 */
export const packBinary = async (state: GameState, history: Record<string, HistoryEntry>): Promise<string> => {
    const historyList = Object.values(history);
    
    // Buffer size calculation: 2048 (increased for section headers) + (16 bytes per history entry) + (extended stats) + (achievements)
    const extendedStatsSize = (EXTENDED_DECAY_STATS.length + EXTENDED_REACTION_STATS.length) * 2;
    const achievementSize = 1 + (ACHIEVEMENT_MAP.length * 5); 
    const bufferSize = 2048 + (historyList.length * 16) + extendedStatsSize + achievementSize;
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    let offset = 0;

    // --- Magic Number (4 bytes) ---
    view.setUint32(offset, 0x53415645); offset += 4; // "SAVE"

    const writeSection = (id: SaveSectionId, writer: () => void) => {
        view.setUint8(offset++, id);
        const lengthOffset = offset;
        offset += 4; // Reserve space for length (Uint32)
        const dataStart = offset;
        writer();
        const length = offset - dataStart;
        view.setUint32(lengthOffset, length);
    };

    // Section 1: CORE
    writeSection(SaveSectionId.CORE, () => {
        // Version string
        view.setUint8(offset++, APP_VERSION.length);
        for (let i = 0; i < APP_VERSION.length; i++) {
            view.setUint8(offset++, APP_VERSION.charCodeAt(i));
        }

        view.setFloat64(offset, state.score); offset += 8;
        view.setUint32(offset, state.energyPoints); offset += 4;
        view.setUint8(offset++, state.gameOver ? 0 : state.hp);
        view.setUint8(offset++, state.playerLevel);
        view.setUint16(offset, state.reincarnations); offset += 2;
        view.setUint32(offset, state.turn); offset += 4;
        view.setUint8(offset++, state.currentNuclide.z);
        view.setUint16(offset, state.currentNuclide.a); offset += 2;
        view.setUint16(offset, state.maxCombo); offset += 2;
        view.setUint8(offset++, state.magicBarrierCharges);
        view.setUint32(offset, Math.floor(state.elapsedTime)); offset += 4;
    });

    // Section 2: UNLOCKED
    writeSection(SaveSectionId.UNLOCKED, () => {
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
    });

    // Section 3: STATISTICS
    writeSection(SaveSectionId.STATISTICS, () => {
        DECAY_MODE_MAP.slice(0, 8).forEach(mode => {
            view.setUint16(offset, state.decayStats[mode] || 0); offset += 2;
        });
        [HISTORY_METHODS.REACTION_NG, HISTORY_METHODS.REACTION_NP, HISTORY_METHODS.REACTION_N2N, HISTORY_METHODS.REACTION_NA, HISTORY_METHODS.REACTION_NF].forEach(r => {
            view.setUint16(offset, state.reactionStats[r] || 0); offset += 2;
        });

        let masteredBits = 0;
        state.masteredDecays.forEach(m => {
            const idx = BASE_MASTERY_MODES.indexOf(m);
            if (idx !== -1) masteredBits |= (1 << idx);
        });
        view.setUint32(offset, masteredBits); offset += 4;

        view.setUint16(offset, Math.min(65535, state.reincarnationPool.p)); offset += 2;
        view.setUint16(offset, Math.min(65535, state.reincarnationPool.n)); offset += 2;
        view.setUint16(offset, Math.min(65535, state.reincarnationPool.e)); offset += 2;

        let progressBits = 0;
        if (state.realPhysicsUnlockProgress.hasScatteredProton) progressBits |= (1 << 0);
        if (state.realPhysicsUnlockProgress.hasScatteredElectron) progressBits |= (1 << 1);
        if (state.realPhysicsUnlockProgress.hasAbsorbedNeutron) progressBits |= (1 << 2);
        view.setUint8(offset++, progressBits);

        let tutorialBits = 0;
        if (state.hasSeenDecayTutorial) tutorialBits |= (1 << 0);
        if (state.hasSeenCaptureTutorial) tutorialBits |= (1 << 1);
        if (state.hasSeenDripLineTutorial) tutorialBits |= (1 << 2);
        if (state.hasSeenEngraveTutorial) tutorialBits |= (1 << 3);
        if (state.hasSeenSkillToggleTutorial) tutorialBits |= (1 << 4);
        if (state.hasPerformedActiveReincarnation) tutorialBits |= (1 << 5);
        view.setUint8(offset++, tutorialBits);

        EXTENDED_DECAY_STATS.forEach(mode => {
            view.setUint16(offset, state.decayStats[mode] || 0); offset += 2;
        });
        EXTENDED_REACTION_STATS.forEach(r => {
            view.setUint16(offset, state.reactionStats[r] || 0); offset += 2;
        });
    });

    // Section 4: ACHIEVEMENTS
    writeSection(SaveSectionId.ACHIEVEMENTS, () => {
        const achievedIds = Object.keys(state.achievementTimes).filter(id => ACHIEVEMENT_MAP.includes(id));
        view.setUint8(offset++, achievedIds.length);
        achievedIds.forEach(id => {
            const idx = ACHIEVEMENT_MAP.indexOf(id);
            view.setUint8(offset++, idx);
            view.setUint32(offset, Math.floor(state.achievementTimes[id])); offset += 4;
        });
    });

    // Section 5: HISTORY
    writeSection(SaveSectionId.HISTORY, () => {
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
            view.setUint8(offset++, h.isEngraved ? 1 : 0);
        });
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
        // 1. Handle common URL-safe base64 conversions and URL decoding artifacts
        let sanitized = code.trim()
            .replace(/-/g, '+')
            .replace(/_/g, '/')
            .replace(/\r?\n|\r/g, ''); // Remove newlines first
            
        // 2. Handle the common '+' -> ' ' conversion from URL parameters
        if (sanitized.includes(' ')) {
            sanitized = sanitized.replace(/ /g, '+');
        }
            
        // 3. Remove any remaining invalid characters
        sanitized = sanitized.replace(/[^A-Za-z0-9+/=]/g, '');
        
        if (sanitized.length === 0 || sanitized.length % 4 === 1) {
            return null;
        }
        
        while (sanitized.length % 4 !== 0) sanitized += '=';
        
        const binString = atob(sanitized);
        const bytes = new Uint8Array(binString.length);
        for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
        
        const decompressed = await decompress(bytes.buffer);
        const finalBytes = new Uint8Array(decompressed);

        const view = new DataView(finalBytes.buffer);
        let offset = 0;

        // --- Format Detection ---
        // Check for Magic Number "SAVE" (0x53415645)
        if (view.byteLength < 4) return null;
        const magic = view.getUint32(offset);
        if (magic !== 0x53415645) {
            console.error("Invalid save format: Missing magic number");
            return null;
        }
        offset += 4;

        const payload: Partial<SavePayload> = {
            st: {},
            rs: {},
            at: {},
            ev: {}
        };

        while (offset < view.byteLength) {
            if (offset + 5 > view.byteLength) break; // Need at least ID (1) + Length (4)
            const sectionId = view.getUint8(offset++);
            const sectionLength = view.getUint32(offset); offset += 4;
            const nextSectionOffset = offset + sectionLength;

            if (nextSectionOffset > view.byteLength) break; // Corrupted section

            switch (sectionId) {
                case SaveSectionId.CORE:
                    const vLen = view.getUint8(offset++);
                    let v = "";
                    for (let i = 0; i < vLen; i++) {
                        v += String.fromCharCode(view.getUint8(offset++));
                    }
                    payload.v = v;

                    payload.s = view.getFloat64(offset); offset += 8;
                    payload.e = view.getUint32(offset); offset += 4;
                    payload.h = view.getUint8(offset++);
                    payload.l = view.getUint8(offset++);
                    payload.r = view.getUint16(offset); offset += 2;
                    payload.t = view.getUint32(offset); offset += 4;
                    payload.cz = view.getUint8(offset++);
                    payload.ca = view.getUint16(offset); offset += 2;
                    payload.mc = view.getUint16(offset); offset += 2;
                    payload.mb = view.getUint8(offset++);
                    payload.et = view.getUint32(offset); offset += 4;
                    break;
                case SaveSectionId.UNLOCKED:
                    const ue: number[] = [];
                    for (let i = 0; i < 15; i++) {
                        const byte = view.getUint8(offset++);
                        for (let bit = 0; bit < 8; bit++) {
                            if (byte & (1 << bit)) ue.push(i * 8 + bit);
                        }
                    }
                    payload.ue = ue;
                    const ugBits = view.getUint32(offset); offset += 4;
                    payload.ug = GROUP_MAP.filter((_, i) => ugBits & (1 << i));
                    const dsBits = view.getUint32(offset); offset += 4;
                    payload.ds = GROUP_MAP.filter((_, i) => dsBits & (1 << i));
                    break;
                case SaveSectionId.STATISTICS:
                    DECAY_MODE_MAP.slice(0, 8).forEach(mode => {
                        if (offset + 2 <= nextSectionOffset) {
                            payload.st![mode] = view.getUint16(offset); offset += 2;
                        }
                    });
                    [HISTORY_METHODS.REACTION_NG, HISTORY_METHODS.REACTION_NP, HISTORY_METHODS.REACTION_N2N, HISTORY_METHODS.REACTION_NA, HISTORY_METHODS.REACTION_NF].forEach(r => {
                        if (offset + 2 <= nextSectionOffset) {
                            payload.rs![r] = view.getUint16(offset); offset += 2;
                        }
                    });
                    const mdBits = view.getUint32(offset); offset += 4;
                    payload.md = BASE_MASTERY_MODES.filter((_, i) => mdBits & (1 << i)) as DecayMode[];
                    payload.pp = view.getUint16(offset); offset += 2;
                    payload.pn = view.getUint16(offset); offset += 2;
                    payload.pe = view.getUint16(offset); offset += 2;
                    const progressBits = view.getUint8(offset++);
                    payload.rp = {
                        p: !!(progressBits & (1 << 0)),
                        e: !!(progressBits & (1 << 1)),
                        n: !!(progressBits & (1 << 2))
                    };
                    const tutorialBits = view.getUint8(offset++);
                    payload.tf = {
                        d: !!(tutorialBits & (1 << 0)),
                        c: !!(tutorialBits & (1 << 1)),
                        l: !!(tutorialBits & (1 << 2)),
                        e: !!(tutorialBits & (1 << 3)),
                        s: !!(tutorialBits & (1 << 4)),
                        ar: !!(tutorialBits & (1 << 5))
                    };
                    EXTENDED_DECAY_STATS.forEach(mode => {
                        if (offset + 2 <= nextSectionOffset) {
                            payload.st![mode] = view.getUint16(offset); offset += 2;
                        }
                    });
                    EXTENDED_REACTION_STATS.forEach(r => {
                        if (offset + 2 <= nextSectionOffset) {
                            payload.rs![r] = view.getUint16(offset); offset += 2;
                        }
                    });
                    break;
                case SaveSectionId.ACHIEVEMENTS:
                    const achievementCount = view.getUint8(offset++);
                    for (let i = 0; i < achievementCount; i++) {
                        if (offset + 5 <= nextSectionOffset) {
                            const idx = view.getUint8(offset++);
                            const time = view.getUint32(offset); offset += 4;
                            if (ACHIEVEMENT_MAP[idx]) {
                                payload.at![ACHIEVEMENT_MAP[idx]] = time;
                            }
                        }
                    }
                    break;
                case SaveSectionId.HISTORY:
                    const historyLen = view.getUint16(offset); offset += 2;
                    for (let i = 0; i < historyLen; i++) {
                        if (offset + 7 > nextSectionOffset) break;
                        const rpz = view.getUint8(offset++);
                        const pz = rpz === 255 ? null : rpz;
                        const pa = view.getUint16(offset); offset += 2;
                        const z = view.getUint8(offset++);
                        const a = view.getUint16(offset); offset += 2;
                        const mIdx = view.getUint8(offset++);
                        const method = mIdx === 255 ? TITLES.UNKNOWN : (METHOD_MAP[mIdx] || HISTORY_METHODS.TRANSMUTATION);
                        let firstTurn = 0;
                        let lastTurn = 0;
                        if (offset + 8 <= nextSectionOffset) {
                            firstTurn = view.getUint32(offset); offset += 4;
                            lastTurn = view.getUint32(offset); offset += 4;
                        }
                        let isEngraved = false;
                        if (offset < nextSectionOffset) {
                            isEngraved = view.getUint8(offset++) === 1;
                        }
                        const key = `${z}-${a}`;
                        payload.ev![key] = `${pz === null ? 'null' : pz}:${pa}:${method}:${firstTurn}:${lastTurn}:${isEngraved ? 1 : 0}`;
                    }
                    break;
            }
            offset = nextSectionOffset;
        }
        return payload as SavePayload;
    } catch (e) {
        console.error("Unpack failed:", e instanceof Error ? e.message : String(e));
        return null;
    }
};
