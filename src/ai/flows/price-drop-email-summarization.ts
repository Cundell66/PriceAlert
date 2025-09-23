'use server';
/**
 * @fileOverview Summarizes price drop details for email notifications and handles monitoring.
 *
 * - summarizePriceDrop - A function that summarizes price drop information.
 * - PriceDropInfo - The input type for the summarizePriceDrop function.
 * - PriceDropSummary - The return type for the summarizePriceDrop function.
 * - monitorPriceDrops - A flow that monitors the cruise API for price drops.
 * - sendPriceDropEmail - A flow that sends an email notification for a price drop.
 */

import { ai } from '@/ai/genkit';
import { fetchCruises, type Cruise } from '@/lib/cruise-api';
import { getStore } from 'genkit/store';
import { z } from 'genkit';

// Schemas for price drop information
const PriceDropInfoSchema = z.object({
  shipName: z.string().describe('The name of the cruise ship.'),
  cruiseDate: z.string().describe('The date of the cruise.'),
  vendorId: z.string().describe('The vendor ID of the cruise.'),
  priceFrom: z.number().describe('The original price of the cruise.'),
  priceTo: z.number().describe('The new, reduced price of the cruise.'),
});
export type PriceDropInfo = z.infer<typeof PriceDropInfoSchema>;

const PriceDropSummarySchema = z.object({
  summary: z.string().describe('A user-friendly summary of the price drop, highlighting key details and potential savings.'),
});
export type PriceDropSummary = z.infer<typeof PriceDropSummarySchema>;

const EmailNotificationSchema = PriceDropInfoSchema.extend({
    toEmail: z.string().email().describe('The email address to send the notification to.'),
});

// Prompt for summarizing price drops
const priceDropEmailSummarizationPrompt = ai.definePrompt({
  name: 'priceDropEmailSummarizationPrompt',
  input: { schema: PriceDropInfoSchema },
  output: { schema: PriceDropSummarySchema },
  prompt: `You are an expert in creating exciting and informative summaries for price drops on cruises.

  Given the following information about a cruise price drop, generate a short, user-friendly summary that highlights the key details and potential savings. Emphasize the excitement of finding the best deal.

  Ship Name: {{{shipName}}}
  Cruise Date: {{{cruiseDate}}}
  Vendor ID: {{{vendorId}}}
  Original Price: {{{priceFrom}}}
  New Price: {{{priceTo}}}

  Summary:`,
});

// Flow to summarize a price drop
export const summarizePriceDrop = ai.defineFlow(
  {
    name: 'summarizePriceDrop',
    inputSchema: PriceDropInfoSchema,
    outputSchema: PriceDropSummarySchema,
  },
  async (input) => {
    const { output } = await priceDropEmailSummarizationPrompt(input);
    return output!;
  }
);

// Tool to send an email (mocked for now)
const sendEmailTool = ai.defineTool(
    {
        name: 'sendEmail',
        description: 'Sends an email notification about a cruise price drop.',
        inputSchema: z.object({
            to: z.string().email(),
            subject: z.string(),
            body: z.string(),
        }),
        outputSchema: z.object({
            success: z.boolean(),
        }),
    },
    async (input) => {
        console.log('--- SENDING EMAIL ---');
        console.log(`To: ${input.to}`);
        console.log(`Subject: ${input.subject}`);
        console.log(`Body: ${input.body}`);
        console.log('---------------------');
        // In a real app, this would integrate with an email service like SendGrid or Postmark.
        return { success: true };
    }
);

// Flow to send price drop email
export const sendPriceDropEmail = ai.defineFlow(
    {
        name: 'sendPriceDropEmail',
        inputSchema: EmailNotificationSchema,
        outputSchema: z.object({ success: z.boolean() }),
    },
    async (input) => {
        const summaryResult = await summarizePriceDrop(input);

        const emailBody = `
      Hi there!
      Exciting news! We've detected a price drop on a cruise you might be interested in.
      ${summaryResult.summary}
      Details:
      - Ship: ${input.shipName}
      - Date: ${input.cruiseDate}
      - Previous Price: $${input.priceFrom}
      - New Price: $${input.priceTo}
      Happy sailing!
      The CruiseCatcher Team
    `;

        const emailSubject = `Price Drop Alert! ${input.shipName} is now cheaper!`;

        const { output } = await ai.generate({
            prompt: `Send an email to ${input.toEmail} with the subject "${emailSubject}" and the following body: ${emailBody}`,
            tools: [sendEmailTool],
        });
        
        const toolOutput = output.toolCalls[0]?.output;

        return { success: !!toolOutput?.success };
    }
);


// Main monitoring flow
export const monitorPriceDrops = ai.defineFlow(
  {
    name: 'monitorPriceDrops',
    description: 'Monitors the cruise API for price drops and triggers alerts.',
  },
  async () => {
    const store = getStore();
    const config = await store.read("config/user");

    if (!config || !config.email) {
      console.log('Monitoring skipped: User configuration not found.');
      return;
    }

    console.log('Fetching current cruise prices...');
    const currentCruises = await fetchCruises();
    const previousCruises = (await store.read<Cruise[]>('cruises/latest')) || [];

    console.log(`Found ${currentCruises.length} current cruises.`);
    console.log(`Found ${previousCruises.length} previous cruises to compare against.`);

    if (previousCruises.length > 0) {
      for (const currentCruise of currentCruises) {
        const previousCruise = previousCruises.find(
          (c) => c.vendor_id === currentCruise.vendor_id
        );

        if (previousCruise) {
          const currentPrice = parseFloat(currentCruise.cruise_only_price);
          const previousPrice = parseFloat(previousCruise.cruise_only_price);

          if (currentPrice < previousPrice) {
            console.log(`Price drop detected for ${currentCruise.name}!`);
            const priceDropInfo: z.infer<typeof EmailNotificationSchema> = {
              shipName: currentCruise.ship_title,
              cruiseDate: new Date(currentCruise.starts_on).toLocaleDateString(),
              vendorId: currentCruise.vendor_id,
              priceFrom: previousPrice,
              priceTo: currentPrice,
              toEmail: config.email,
            };
            await sendPriceDropEmail(priceDropInfo);
          }
        }
      }
    }

    console.log('Saving current cruise prices for next check...');
    await store.write('cruises/latest', currentCruises);
    console.log('Monitoring complete.');
  }
);
