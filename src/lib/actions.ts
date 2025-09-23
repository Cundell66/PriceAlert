"use server";

import {
  summarizePriceDrop,
  type PriceDropInfo,
  sendPriceDropEmail,
  getLatestPriceDrop,
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

export async function sendEmailAction(priceDropInfo: PriceDropInfo) {
  try {
    const toEmail = process.env.NOTIFICATION_EMAIL;
    if (!toEmail) {
      return { success: false, error: "NOTIFICATION_EMAIL environment variable not set." };
    }
    await sendPriceDropEmail({ ...priceDropInfo, toEmail });
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: "Failed to send email notification." };
  }
}

export async function getLatestPriceDropAction() {
  try {
    const result = await getLatestPriceDrop();
    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching latest price drop:", error);
    return { success: false, error: "Failed to fetch latest price drop." };
  }
}

export async function saveConfigurationAction(email: string) {
    // This function is no longer used but kept to avoid breaking other parts of the example.
    // In a real app, you might remove this entirely if configuration is only via .env
    console.log("saveConfigurationAction is deprecated. Use environment variables.");
    return { success: true };
}
