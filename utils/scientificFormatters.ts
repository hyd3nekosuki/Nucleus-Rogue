/**
 * Scientific data formatters for the Nucleus system.
 * Handles time-scaling and large number notation (Metric prefixes).
 */

/**
 * Formats a score value using scientific metric prefixes.
 * Supports up to Yotta (10^24).
 */
export const formatScore = (val: number): string => {
    if (val < 1000000) return val.toLocaleString();
    
    const units = [
        { v: 1e24, s: "Y" }, // Yotta
        { v: 1e21, s: "Z" }, // Zetta
        { v: 1e18, s: "E" }, // Exa
        { v: 1e15, s: "P" }, // Peta
        { v: 1e12, s: "T" }, // Tera
        { v: 1e9,  s: "G" }, // Giga
        { v: 1e6,  s: "M" }, // Mega
    ];

    for (const unit of units) {
        if (val >= unit.v) {
            const scaled = val / unit.v;
            return Number(scaled.toPrecision(4)).toString() + " " + unit.s;
        }
    }
    return val.toLocaleString();
};

/**
 * Converts seconds into a high-precision scientific time string.
 */
export const formatPreciseHalfLife = (seconds: number): string => {
    if (seconds === Infinity) return "Stable";
    
    // Handle 'V' flag (mapped to 1e-9) or extremely short/unmeasured measurements
    if (seconds <= 1e-9) return "< 1 ns";

    // Use scientific notation for very fast decays (less than 1ms but greater than 1ns)
    if (seconds < 1e-3) {
        return `${seconds.toExponential(3)} s`;
    }

    // Seconds
    if (seconds < 60) {
        return `${parseFloat(seconds.toPrecision(4))} s`;
    }
    
    // Minutes
    if (seconds < 3600) {
        return `${parseFloat((seconds / 60).toPrecision(4))} m`;
    }

    // Hours
    if (seconds < 86400) {
        return `${parseFloat((seconds / 3600).toPrecision(4))} h`;
    }

    // Days
    const YEAR = 31557600; // 365.25 days
    if (seconds < YEAR) {
        return `${parseFloat((seconds / 86400).toPrecision(4))} d`;
    }

    // Years
    const years = seconds / YEAR;
    if (years >= 1e4) {
        return `${years.toExponential(3)} y`;
    }
    return `${parseFloat(years.toPrecision(4))} y`;
};
