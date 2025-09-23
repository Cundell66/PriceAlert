"use server";

import {
  summarizePriceDrop,
  type PriceDropInfo,
} from "@/ai/flows/price-drop-email-summarization";

export async function generateSummaryAction(priceDropInfo: PriceDropInfo) {
  try {
    const result = await summarizePriceDrop(priceDropInfo);
    return { success: true, summary: result.summary };
  } catch (error) {
    console.error("Error generating summary:", error);
    return { success: false, error: "Failed to generate summary." };
  }
}
