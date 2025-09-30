
"use server";

import {
  summarizePriceDrop,
  type PriceDropInfo,
  sendPriceDropEmail,
  getRecentPriceDrops,
  monitorPriceDrops,
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

export async function sendTestEmailAction() {
  try {
    const toEmail = process.env.NOTIFICATION_EMAIL;
    if (!toEmail) {
      return { success: false, error: "NOTIFICATION_EMAIL environment variable not set." };
    }
    
    // Create a mock price drop list for the test email
    const testPriceDrops: PriceDropInfo[] = [
      {
        shipName: "Imaginary Voyager",
        cruiseDate: "1st January 2025",
        vendorId: "TEST-001",
        dealName: "DRINKS-INC",
        gradeCode: "IV-BAL",
        gradeName: "Balcony",
        priceFrom: 1200,
        priceTo: 950,
        detectedAt: new Date().toISOString()
      },
      {
        shipName: "Fantasy Seas",
        cruiseDate: "15th February 2025",
        vendorId: "TEST-002",
        dealName: "NO-DRINKS",
        gradeCode: "FS-SUI",
        gradeName: "Suite",
        priceFrom: 2500,
        priceTo: 2200,
        detectedAt: new Date().toISOString()
      }
    ];

    const result = await sendPriceDropEmail({ toEmail, priceDrops: testPriceDrops });
    return { success: result.success };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: "Failed to send email notification." };
  }
}

export async function getRecentPriceDropsAction() {
  try {
    const result = await getRecentPriceDrops();
    // An empty array is a valid success case
    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching recent price drops:", error);
    return { success: false, error: "An unexpected error occurred while fetching recent price drops." };
  }
}

export async function runCronJobAction() {
  try {
    console.log("Manual cron job started: Checking for price drops...");
    await monitorPriceDrops();
    console.log("Manual cron job finished successfully.");
    return { success: true, message: "Price drop check completed." };
  } catch (error: any) {
    console.error("Error running manual cron job:", error);
    return { success: false, error: `Cron job failed: ${error.message}` };
  }
}

