import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

export interface ParsedOrder {
  address: string;
  lat: number;
  lng: number;
  weight: number;
  time_window_start: string | null;
  time_window_end: string | null;
}

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    orders: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          address: { type: SchemaType.STRING },
          lat: { type: SchemaType.NUMBER },
          lng: { type: SchemaType.NUMBER },
          weight: { type: SchemaType.NUMBER },
          time_window_start: { type: SchemaType.STRING, nullable: true },
          time_window_end: { type: SchemaType.STRING, nullable: true },
        },
        required: ["address", "lat", "lng", "weight"],
      },
    },
  },
  required: ["orders"],
};

export async function parseOrdersFromText(rawText: string): Promise<ParsedOrder[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      maxOutputTokens: 4096,
    },
  });

  const prompt = `You extract structured delivery order data from messy free-text order notes.
For each distinct order mentioned in the text below, produce one JSON object with:
- address: the delivery address as written (cleaned up)
- lat, lng: your best-effort geocoded coordinates for that address (use real-world knowledge; if the city/area is identifiable, estimate realistic coordinates)
- weight: package weight in kg (default to 1 if not mentioned)
- time_window_start / time_window_end: 24h "HH:MM" strings if a delivery time window is mentioned, otherwise null

You are extracting data only — never decide delivery order, routes, or rider assignment.

Text:
"""
${rawText}
"""`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonText = text.startsWith("```") ? text.replace(/^```[a-z]*\n?/, "").replace(/```$/, "") : text;
  const parsed = JSON.parse(jsonText) as { orders: ParsedOrder[] };
  return parsed.orders;
}
