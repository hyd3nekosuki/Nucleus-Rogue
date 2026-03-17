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