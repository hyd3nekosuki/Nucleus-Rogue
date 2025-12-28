
import { GoogleGenAI } from "@google/genai";
import { NuclideData, NuclideCategory } from "../types";
import { getSymbol } from "../constants";

/**
 * Service to enrich nuclide data with dynamic descriptions using Gemini API.
 */

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export const fetchNuclideDescription = async (z: number, a: number, name: string): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 2; // Retry once if it fails with a transient error

  while (attempts < maxAttempts) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Provide a one-sentence scientific and interesting fact about the nuclide ${name} (Z=${z}, A=${a}). Keep it strictly under 150 characters. Focus on its stability, occurrence, or use in physics.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const text = response.text?.trim();
      if (text) return text;
      
      throw new Error("Empty response from model");
    } catch (error: any) {
      attempts++;
      console.error(`Gemini API Error (Attempt ${attempts}/${maxAttempts}):`, error);
      
      // If it's a transient server error (like 500), wait a bit and retry once
      if (attempts < maxAttempts) {
        await sleep(2000 * attempts);
        continue;
      }
      
      // If all retries fail, return a fallback message
      return "Science episode link restricted by stability fields.";
    }
  }
  return "Information currently unavailable.";
};

// Compatibility shim
export const fetchNuclideData = async (z: number, a: number): Promise<NuclideData> => {
    return {
        z, a, symbol: getSymbol(z), name: '', halfLifeText: '', halfLifeSeconds: 0, 
        decayModes: [], category: NuclideCategory.STABLE, isStable: true, exists: true,
        description: "Analyzing..."
    };
};
