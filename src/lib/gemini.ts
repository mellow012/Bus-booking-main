// lib/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

/**
 * Helper to generate a structured search query from natural language.
 * This is the "Smart Search" fuel for TibhukeBus.
 */
export const generateSmartSearchQuery = async (userInput: string) => {
  const prompt = `
    You are the TibhukeBus Search Assistant. 
    Transform the follow user request into a JSON search object.
    
    User Request: "${userInput}"
    
    JSON Format:
    {
      "origin": "City Name or null",
      "destination": "City Name or null",
      "date": "YYYY-MM-DD or null",
      "busType": "AC | Luxury | Sleeper | null"
    }
    
    Return ONLY the JSON. No conversation.
  `;

  try {
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (error) {
    console.error("[Gemini] Smart Search Parsing failed:", error);
    return null;
  }
};
