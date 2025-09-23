"use server";

import {
  summarizePriceDrop,
  type PriceDropInfo,
  sendPriceDropEmail,
} from "@/ai/flows/price-drop-email-summarization";
import { getStore } from "genkit";

export async function generateSummaryAction(priceDropInfo: PriceDropInfo) {
  try {
    const result = await summarizePriceDrop(priceDropInfo);
    return { success: true, summary: result.summary };
  } catch (error) {
    console.error("Error generating summary:", error);
    return { success: false, error: "Failed to generate summary." };
  }
}

export async function sendEmailAction(priceDropInfo: PriceDropInfo) {
  try {
    const store = getStore();
    const config = await store.read("config/user");
    if (!config || !config.email) {
      return { success: false, error: "Configuration not found. Please save your email first." };
    }
    await sendPriceDropEmail({ ...priceDropInfo, toEmail: config.email });
    return { success: true };
  } catch (error)
    console.error("Error sending email:", error);
    return { success: false, error: "Failed to send email notification." };
  }
}

export async function saveConfigurationAction(email: string) {
    try {
        const store = getStore();
        await store.write("config/user", { email });
        return { success: true };
    } catch (error) {
        console.error("Error saving configuration:", error);
        return { success: false, error: "Failed to save configuration." };
    }
}
