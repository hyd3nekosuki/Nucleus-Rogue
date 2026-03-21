/**
 * Pure Web Audio API synthesis functions.
 * Extracted from useAudioEngine to separate sound generation from sequencing logic.
 */

// --- Shared Audio Resources (Cached to prevent CPU spikes) ---
let cachedNoiseBuffer: AudioBuffer | null = null;
let cachedGabberCurveHeavy: Float32Array | null = null;
let cachedGabberCurveSharp: Float32Array | null = null;

const getNoiseBuffer = (ctx: AudioContext) => {
    if (cachedNoiseBuffer) return cachedNoiseBuffer;
    const bufferSize = ctx.sampleRate * 0.5; // 0.5s of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    cachedNoiseBuffer = buffer;
    return buffer;
};

const getDistortionCurve = (dist: number) => {
    if (dist === 25 && cachedGabberCurveHeavy) return cachedGabberCurveHeavy;
    if (dist === 15 && cachedGabberCurveSharp) return cachedGabberCurveSharp;
    
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; i++) {
        const x = (i / n_samples) * 2 - 1;
        curve[i] = (Math.PI + dist) * x / (Math.PI + dist * Math.abs(x));
    }
    
    if (dist === 25) cachedGabberCurveHeavy = curve;
    else if (dist === 15) cachedGabberCurveSharp = curve;
    return curve;
};

export const createKick = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, mode: 'standard' | 'heavy-gabber' | 'sharp-gabber' | 'sub-thud' | 'dnb-punch' = 'standard') => {
    if (power <= 0.001) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();

    click.type = 'square';
    click.frequency.setValueAtTime(mode === 'dnb-punch' ? 6000 : 4500, time);
    click.frequency.exponentialRampToValueAtTime(150, time + 0.02);
    clickGain.gain.setValueAtTime(0, time);
    clickGain.gain.linearRampToValueAtTime(0.22 * power, time + 0.002); 
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    clickGain.gain.linearRampToValueAtTime(0, time + 0.025); 
    
    osc.type = 'sine';
    const isGabber = mode.includes('gabber');
    const startFreq = mode === 'heavy-gabber' ? 68 : (mode === 'sharp-gabber' ? 98 : (mode === 'sub-thud' ? 48 : (mode === 'dnb-punch' ? 78 : 64)));
    const decayTime = isGabber ? 0.35 : (mode === 'sub-thud' ? 0.55 : (mode === 'dnb-punch' ? 0.22 : 0.38));
    
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(1, time + decayTime);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.7 * power, time + 0.005); 
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decayTime);
    gain.gain.linearRampToValueAtTime(0, time + decayTime + 0.015); 

    if (isGabber) {
        const shaper = ctx.createWaveShaper();
        shaper.curve = getDistortionCurve(mode === 'heavy-gabber' ? 25 : 15);
        osc.connect(shaper); shaper.connect(gain);
    } else {
        osc.connect(gain);
    }

    gain.connect(dest);
    click.connect(clickGain); clickGain.connect(dest);

    osc.start(time); osc.stop(time + decayTime + 0.05);
    click.start(time); click.stop(time + 0.05);
};

export const createSnare = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, color: 'sharp' | 'heavy' | 'industrial' | 'dnb-crack' = 'sharp') => {
    if (power <= 0.001) return;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = (color === 'industrial' || color === 'dnb-crack') ? 'highpass' : 'bandpass';
    filter.frequency.setValueAtTime(color === 'heavy' ? 800 : (color === 'industrial' ? 3500 : (color === 'dnb-crack' ? 1800 : 2200)), time);
    filter.Q.setValueAtTime(color === 'dnb-crack' ? 1.0 : 4.0, time);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime((color === 'dnb-crack' ? 0.5 : 0.35) * power, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (color === 'dnb-crack' ? 0.12 : 0.15));
    gain.gain.linearRampToValueAtTime(0, time + (color === 'dnb-crack' ? 0.15 : 0.18));

    noise.connect(filter); filter.connect(gain); gain.connect(dest);
    noise.start(time); noise.stop(time + 0.2);
};

export const createHat = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0, weight: number = 1.0) => {
    if (power <= 0.001) return;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(11500, time);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.09 * weight * power, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    gain.gain.linearRampToValueAtTime(0, time + 0.08);

    noise.connect(filter); filter.connect(gain); gain.connect(dest);
    noise.start(time); noise.stop(time + 0.1);
};

/**
 * Camera Shutter Sound Synthesis
 * Mimics a mechanical shutter click using high-pass filtered white noise pulses.
 */
export const createShutterSound = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0) => {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2500, time);
    filter.Q.setValueAtTime(1, time);

    const gain = ctx.createGain();
    // Shutter "ka-chak" (Two quick pulses)
    gain.gain.setValueAtTime(0, time);
    // Click 1 (Curtain 1)
    gain.gain.linearRampToValueAtTime(0.5 * power, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.02);
    // Short Gap
    gain.gain.setValueAtTime(0.01, time + 0.04);
    // Click 2 (Curtain 2)
    gain.gain.linearRampToValueAtTime(0.4 * power, time + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    gain.gain.linearRampToValueAtTime(0, time + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(time);
    noise.stop(time + 0.15);
};

/**
 * Enemy Defeat Sound Synthesis (Alpha/SF Reaction)
 * A noisy, resonant "pop" or "shatter" sound to signify an enemy being destroyed by a reaction.
 */
export const createDefeatSound = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0) => {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, time);
    filter.frequency.exponentialRampToValueAtTime(400, time + 0.2);
    filter.Q.setValueAtTime(8, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.8 * power, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    gain.gain.linearRampToValueAtTime(0, time + 0.3);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.15);

    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.setValueAtTime(2000, time);
    oscFilter.frequency.exponentialRampToValueAtTime(100, time + 0.15);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, time);
    oscGain.gain.linearRampToValueAtTime(0.5 * power, time + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(dest);

    noise.start(time);
    noise.stop(time + 0.3);
    osc.start(time);
    osc.stop(time + 0.3);
};

/**
 * Alpha Decay Defeat Sound Synthesis (Heavy Gunshot)
 * Redesigned to sound like a powerful, heavy gunshot.
 * Combines a sharp high-pressure crack, a deep sub-bass thump, and a metallic mechanical tail.
 */
export const createAlphaDefeatSound = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0) => {
    // 1. The "Crack" (High-pressure transient)
    const crackNoise = ctx.createBufferSource();
    crackNoise.buffer = getNoiseBuffer(ctx);

    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(2000, time);
    crackFilter.frequency.exponentialRampToValueAtTime(800, time + 0.05);
    crackFilter.Q.setValueAtTime(2, time);

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0, time);
    crackGain.gain.linearRampToValueAtTime(1.2 * power, time + 0.001);
    crackGain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    crackNoise.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(dest);

    // 2. The "Thump" (Deep sub-bass boom)
    const thumpOsc = ctx.createOscillator();
    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(150, time);
    thumpOsc.frequency.exponentialRampToValueAtTime(40, time + 0.15);

    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0, time);
    thumpGain.gain.linearRampToValueAtTime(1.5 * power, time + 0.005);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(dest);

    // 3. The "Mechanical Grit" (Mid-range body)
    const gritOsc = ctx.createOscillator();
    gritOsc.type = 'sawtooth';
    gritOsc.frequency.setValueAtTime(200, time);
    gritOsc.frequency.exponentialRampToValueAtTime(60, time + 0.1);

    const gritFilter = ctx.createBiquadFilter();
    gritFilter.type = 'lowpass';
    gritFilter.frequency.setValueAtTime(1200, time);
    gritFilter.frequency.exponentialRampToValueAtTime(300, time + 0.1);

    const gritGain = ctx.createGain();
    gritGain.gain.setValueAtTime(0, time);
    gritGain.gain.linearRampToValueAtTime(0.7 * power, time + 0.01);
    gritGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    gritOsc.connect(gritFilter);
    gritFilter.connect(gritGain);
    gritGain.connect(dest);

    // 4. The "Rumble/Tail" (Low-end resonance)
    const tailNoise = ctx.createBufferSource();
    tailNoise.buffer = getNoiseBuffer(ctx);

    const tailFilter = ctx.createBiquadFilter();
    tailFilter.type = 'lowpass';
    tailFilter.frequency.setValueAtTime(400, time);
    tailFilter.frequency.exponentialRampToValueAtTime(30, time + 0.5);

    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(0, time);
    tailGain.gain.linearRampToValueAtTime(0.5 * power, time + 0.05);
    tailGain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

    tailNoise.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(dest);

    // Start/Stop
    crackNoise.start(time);
    crackNoise.stop(time + 0.1);
    thumpOsc.start(time);
    thumpOsc.stop(time + 0.5);
    gritOsc.start(time);
    gritOsc.stop(time + 0.25);
    tailNoise.start(time);
    tailNoise.stop(time + 0.7);
};

/**
 * Fission Explosion Sound Synthesis
 * A heavy, multi-layered sound for Spontaneous Fission.
 * Combines a sub-bass thump, a mid-range "crack", and a long, resonant noise tail.
 */
export const createFissionExplosionSound = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0) => {
    // 1. Sub-bass Thump (The "Weight")
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(60, time);
    subOsc.frequency.exponentialRampToValueAtTime(30, time + 0.2);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0, time);
    subGain.gain.linearRampToValueAtTime(0.8 * power, time + 0.01);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    // 2. Mid-range Crack (The "Impact")
    const crackOsc = ctx.createOscillator();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(180, time);
    crackOsc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'lowpass';
    crackFilter.frequency.setValueAtTime(1500, time);
    crackFilter.frequency.exponentialRampToValueAtTime(200, time + 0.1);

    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0, time);
    crackGain.gain.linearRampToValueAtTime(0.6 * power, time + 0.005);
    crackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    // 3. Resonant Noise (The "Shatter/Debris")
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(3000, time);
    noiseFilter.frequency.exponentialRampToValueAtTime(400, time + 0.4);
    noiseFilter.Q.setValueAtTime(10, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, time);
    noiseGain.gain.linearRampToValueAtTime(0.5 * power, time + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

    // Connections
    subOsc.connect(subGain);
    subGain.connect(dest);

    crackOsc.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(dest);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);

    // Start/Stop
    subOsc.start(time);
    subOsc.stop(time + 0.6);
    crackOsc.start(time);
    crackOsc.stop(time + 0.2);
    noise.start(time);
    noise.stop(time + 0.7);
};

/**
 * Katana Slice Sound Synthesis (Pair Annihilation)
 * Mimics a sharp, metallic "shing" sound of a Japanese sword slicing through the air.
 * Combines inharmonic sine oscillators for the metal and a filtered noise sweep for the air.
 */
export const createKatanaSliceSound = (ctx: AudioContext, dest: AudioNode, time: number, power: number = 1.0) => {
    // 1. Metallic "Shing" (Inharmonic sine oscillators)
    const freqs = [2500, 3120, 4200, 5800];
    freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.95, time + 0.15);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.15 * power * (1 / (i + 1)), time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1 + (i * 0.02));

        osc.connect(gain);
        gain.connect(dest);
        osc.start(time);
        osc.stop(time + 0.2);
    });

    // 2. The "Slice" (Filtered noise sweep)
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(8000, time);
    filter.frequency.exponentialRampToValueAtTime(1500, time + 0.12);
    filter.Q.setValueAtTime(1.5, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, time);
    noiseGain.gain.linearRampToValueAtTime(0.4 * power, time + 0.005);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);

    noise.start(time);
    noise.stop(time + 0.2);

    // 3. Sharp "Cut" Impact (Short burst of high-passed noise)
    const cutNoise = ctx.createBufferSource();
    cutNoise.buffer = getNoiseBuffer(ctx);

    const cutFilter = ctx.createBiquadFilter();
    cutFilter.type = 'highpass';
    cutFilter.frequency.setValueAtTime(4000, time);

    const cutGain = ctx.createGain();
    cutGain.gain.setValueAtTime(0, time);
    cutGain.gain.linearRampToValueAtTime(0.3 * power, time + 0.001);
    cutGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    cutNoise.connect(cutFilter);
    cutFilter.connect(cutGain);
    cutGain.connect(dest);

    cutNoise.start(time);
    cutNoise.stop(time + 0.05);
};

export const createSynth = (ctx: AudioContext, dest: AudioNode, time: number, freq: number, duration: number, power: number = 1.0, type: 'pulse' | 'sub' | 'dark' | 'gabber' | 'void' | 'acid' | 'dnb-lead' | 'sparkle' = 'pulse') => {
    if (power <= 0.001) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();

    osc1.type = (type === 'gabber' || type === 'acid' || type === 'dnb-lead' || type === 'sparkle') ? 'sawtooth' : (type === 'void' ? 'sine' : (type === 'sub' ? 'sine' : (type === 'dark' ? 'sawtooth' : 'square')));
    osc2.type = osc1.type;
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 1.005, time);

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(3.5, time);

    if (type === 'dark') {
        filter.frequency.setValueAtTime(freq * 3.0, time);
        filter.frequency.exponentialRampToValueAtTime(freq * 0.8, time + duration);
    } else if (type === 'gabber') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 6, time);
        filter.Q.setValueAtTime(8, time);
    } else if (type === 'sparkle') {
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(3500, time);
        panner.pan.setValueAtTime(Math.sin(time * 10) * 0.3, time);
    } else if (type === 'dnb-lead') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 10, time);
        filter.frequency.exponentialRampToValueAtTime(freq * 20, time + duration);
    } else if (type === 'void') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 1.2, time);
    } else if (type === 'acid') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 4, time);
        filter.frequency.exponentialRampToValueAtTime(freq * 1.5, time + duration);
        filter.Q.setValueAtTime(12, time);
    } else {
        filter.frequency.setValueAtTime(2800, time);
    }

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.16 * power, time + 0.008); 
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.gain.linearRampToValueAtTime(0, time + duration + 0.015); 

    osc1.connect(filter); osc2.connect(filter); 
    filter.connect(panner); panner.connect(gain); gain.connect(dest);
    
    osc1.start(time); osc1.stop(time + duration + 0.05);
    osc2.start(time); osc2.stop(time + duration + 0.05);
};