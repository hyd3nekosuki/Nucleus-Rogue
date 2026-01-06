/**
 * Master FX Rack construction.
 * Separates the "wiring" of AudioNodes from the React lifecycle.
 */

export const MASTER_FX_CONFIG = {
    FILTER_HP_FREQ: 45,
    EQ_PEAK_FREQ: 180,
    EQ_PEAK_GAIN: -5.5,
    LIMITER_THRESHOLD: -10,
    LIMITER_KNEE: 3,
    LIMITER_RATIO: 20.0,
    LIMITER_ATTACK: 0.002,
    LIMITER_RELEASE: 0.08,
    MASTER_GAIN: 0.42,
};

export interface MasterRack {
    entry: AudioNode;
    masterGain: GainNode;
}

export const createMasterRack = (ctx: AudioContext): MasterRack => {
    // 1. Create Nodes
    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(MASTER_FX_CONFIG.FILTER_HP_FREQ, ctx.currentTime);

    const eqFilter = ctx.createBiquadFilter();
    eqFilter.type = 'peaking';
    eqFilter.frequency.setValueAtTime(MASTER_FX_CONFIG.EQ_PEAK_FREQ, ctx.currentTime);
    eqFilter.gain.setValueAtTime(MASTER_FX_CONFIG.EQ_PEAK_GAIN, ctx.currentTime); 

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(MASTER_FX_CONFIG.LIMITER_THRESHOLD, ctx.currentTime);
    limiter.knee.setValueAtTime(MASTER_FX_CONFIG.LIMITER_KNEE, ctx.currentTime); 
    limiter.ratio.setValueAtTime(MASTER_FX_CONFIG.LIMITER_RATIO, ctx.currentTime);
    limiter.attack.setValueAtTime(MASTER_FX_CONFIG.LIMITER_ATTACK, ctx.currentTime);
    limiter.release.setValueAtTime(MASTER_FX_CONFIG.LIMITER_RELEASE, ctx.currentTime);
    
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MASTER_FX_CONFIG.MASTER_GAIN, ctx.currentTime); 

    // 2. Connect Chain: Entry -> EQ -> Limiter -> MasterGain -> Destination
    hpFilter.connect(eqFilter); 
    eqFilter.connect(limiter); 
    limiter.connect(masterGain);
    masterGain.connect(ctx.destination);

    return {
        entry: hpFilter,
        masterGain: masterGain
    };
};