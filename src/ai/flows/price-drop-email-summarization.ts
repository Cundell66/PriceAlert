'use server';
/**
 * @fileOverview Summarizes price drop details for email notifications and handles monitoring.
 *
 * - summarizePriceDrop - A function that summarizes price drop information.
 * - PriceDropInfo - The input type for the summarizePriceDrop function.
 * - PriceDropSummary - The return type for the summarizePriceDrop function.
 * - monitorPriceDrops - A flow that monitors the cruise API for price drops.
 * - sendPriceDropEmail - A flow that sends an email notification for a price drop.
 * - getLatestPriceDrop - A flow that retrieves the latest price drop.
 */

import { ai } from '@/ai/genkit';
import { fetchCruises, type Cruise } from '@/lib/cruise-api';
import { getStore } from 'genkit';
import { z } from 'genkit';
import nodemailer from 'nodemailer';

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

// Tool to send an email
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
        try {
             const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || "465"),
                secure: parseInt(process.env.SMTP_PORT || "465") === 465, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD,
                },
            });

            await transporter.sendMail({
                from: `"CruiseCatcher" <${process.env.SMTP_USER}>`,
                to: input.to,
                subject: input.subject,
                html: input.body,
            });

            console.log(`Email sent to ${input.to}`);
            return { success: true };
        } catch (error) {
            console.error('Error sending email with Nodemailer:', error);
            return { success: false };
        }
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
      <p>Hi there!</p>
      <p>Exciting news! We've detected a price drop on a cruise you might be interested in.</p>
      <p><b>${summaryResult.summary}</b></p>
      <p><b>Details:</b></p>
      <ul>
        <li><b>Ship:</b> ${input.shipName}</li>
        <li><b>Date:</b> ${input.cruiseDate}</li>
        <li><b>Previous Price:</b> $${input.priceFrom}</li>
        <li><b>New Price:</b> $${input.priceTo}</li>
      </ul>
      <p>Happy sailing!</p>
      <p>The CruiseCatcher Team</p>
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
    const toEmail = process.env.NOTIFICATION_EMAIL;

    if (!toEmail) {
      console.log('Monitoring skipped: NOTIFICATION_EMAIL environment variable not set.');
      return;
    }

    const store = getStore();
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
              toEmail: toEmail,
            };
            // Save the latest price drop for the UI
            await store.write('cruises/latest-drop', priceDropInfo);

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

// Flow to retrieve the latest price drop
export const getLatestPriceDrop = ai.defineFlow(
  {
    name: 'getLatestPriceDrop',
    description: 'Retrieves the most recent price drop from the store.',
    outputSchema: PriceDropInfoSchema.nullable(),
  },
  async () => {
    const store = getStore();
    const latestDrop = await store.read<PriceDropInfo>('cruises/latest-drop');
    return latestDrop || null;
  }
);
