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
import { z } from 'zod';
import nodemailer from 'nodemailer';
import clientPromise from '@/lib/mongodb';
import { Collection } from 'mongodb';
import { format, parseISO } from 'date-fns';

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
  summary: z.string().describe('A short, exciting summary of the price drop.'),
});
export type PriceDropSummary = z.infer<typeof PriceDropSummarySchema>;


const EmailNotificationSchema = PriceDropInfoSchema.extend({
    toEmail: z.string().email().describe('The email address to send the notification to.'),
});


// MongoDB Collection Names
const LATEST_CRUISES_COLLECTION = 'latestCruises';
const LATEST_DROP_COLLECTION = 'latestPriceDrop';

// Helper to get a collection
async function getCollection<T extends Document>(collectionName: string): Promise<Collection<T> | null> {
    if (!clientPromise) {
        console.warn('MongoDB not configured. Skipping collection retrieval.');
        return null;
    }
    const client = await clientPromise;
    const db = client.db(); // Use default database from connection string
    return db.collection<T>(collectionName);
}

// Function to format date with ordinal
function formatDateWithOrdinal(dateString: string): string {
  try {
    const date = parseISO(dateString);
    const day = date.getDate();
    let suffix = 'th';
    if (day === 1 || day === 21 || day === 31) {
      suffix = 'st';
    } else if (day === 2 || day === 22) {
      suffix = 'nd';
    } else if (day === 3 || day === 23) {
      suffix = 'rd';
    }
    return `${day}${suffix} ${format(date, 'MMMM yyyy')}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Fallback to original string
  }
}

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
                secure: parseInt(process.env.SMTP_PORT || "465") === 465,
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
        <li><b>Previous Price:</b> £${input.priceFrom.toFixed(2)}</li>
        <li><b>New Price:</b> £${input.priceTo.toFixed(2)}</li>
      </ul>
      <p>Happy sailing!</p>
      <p>The CruiseCatcher Team</p>
    `;

        const emailSubject = `Price Drop Alert! ${input.shipName} is now cheaper!`;
        
        const result = await sendEmailTool({
          to: input.toEmail,
          subject: emailSubject,
          body: emailBody
        });

        return { success: result.success };
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

    const latestCruisesCollection = await getCollection(LATEST_CRUISES_COLLECTION);
    const latestDropCollection = await getCollection(LATEST_DROP_COLLECTION);
    
    if (!latestCruisesCollection || !latestDropCollection) {
        console.log('Monitoring skipped: Database not configured.');
        return;
    }
    
    console.log('Fetching current cruise prices...');
    const currentCruises = await fetchCruises();
    
    const previousCruisesDoc = await latestCruisesCollection.findOne({ _id: 'latest' });
    const previousCruises = (previousCruisesDoc ? previousCruisesDoc.cruises : []) as Cruise[];

    console.log(`Found ${currentCruises.length} current cruises.`);
    console.log(`Found ${previousCruises.length} previous cruises to compare against.`);
    
    let dropsFound = 0;
    if (previousCruises.length > 0) {
      for (const currentCruise of currentCruises) {
        const previousCruise = previousCruises.find(
          (c) => c.vendor_id === currentCruise.vendor_id
        );

        if (previousCruise) {
          const currentPrice = parseFloat(currentCruise.cruise_only_price);
          const previousPrice = parseFloat(previousCruise.cruise_only_price);

          if (currentPrice < previousPrice) {
            dropsFound++;
            console.log(`Price drop detected for ${currentCruise.name}!`);
            const priceDropInfo: PriceDropInfo & {toEmail: string} = {
              shipName: currentCruise.ship_title,
              cruiseDate: formatDateWithOrdinal(currentCruise.starts_on),
              vendorId: currentCruise.vendor_id,
              priceFrom: previousPrice,
              priceTo: currentPrice,
              toEmail: toEmail,
            };
            
            // Save the latest price drop to MongoDB for the UI
            await latestDropCollection.updateOne(
                { _id: 'latest' },
                { $set: priceDropInfo },
                { upsert: true }
            );

            await sendPriceDropEmail(priceDropInfo);
          }
        }
      }
    }

    if (dropsFound === 0) {
        console.log("No price drops found on this run.");
    }

    console.log('Saving current cruise prices for next check...');
    await latestCruisesCollection.updateOne(
        { _id: 'latest' },
        { $set: { cruises: currentCruises } },
        { upsert: true }
    );
    
    console.log('Monitoring complete.');
  }
);

// Flow to retrieve the latest price drop
export const getLatestPriceDrop = ai.defineFlow(
  {
    name: 'getLatestPriceDrop',
    description: 'Retrieves the most recent price drop from the flow state.',
    outputSchema: PriceDropInfoSchema.nullable(),
  },
  async () => {
    const latestDropCollection = await getCollection<PriceDropInfo>(LATEST_DROP_COLLECTION);
    
    if (!latestDropCollection) {
        console.warn('MongoDB not configured. Cannot get latest price drop.');
        return null;
    }
    
    const doc = await latestDropCollection.findOne({ _id: 'latest' });

    if (!doc) {
      return null;
    }

    // remove the _id field before returning
    const { _id, ...priceDropData } = doc as any;
    
    return priceDropData;
  }
);
