
'use server';
/**
 * @fileOverview Summarizes price drop details for email notifications and handles monitoring.
 *
 * - summarizePriceDrop - A function that summarizes price drop information.
 * - PriceDropInfo - The input type for the summarizePriceDrop function.
 * - PriceDropSummary - The return type for the summarizePriceDrop function.
 * - monitorPriceDrops - A flow that monitors the cruise API for price drops.
 * - sendPriceDropEmail - A flow that sends an email notification for a price drop.
 * - getRecentPriceDrops - A flow that retrieves recent price drops.
 */

import { ai } from '@/ai/genkit';
import { fetchCruises, type CruiseOffering } from '@/lib/cruise-api';
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
  dealCode: z.string().describe('The specific code for the deal/package.'),
  dealName: z.string().describe('The descriptive name of the deal or package.'),
  gradeCode: z.string().describe('The specific code for the cabin grade (e.g., BR1).'),
  gradeName: z.string().describe('The descriptive name of the cabin grade (e.g., Inside, Balcony).'),
  priceFrom: z.number().describe('The original price of the cruise.'),
  priceTo: z.number().describe('The new, reduced price of the cruise.'),
  detectedAt: z.string().describe('The timestamp when the drop was detected.'),
});
export type PriceDropInfo = z.infer<typeof PriceDropInfoSchema>;

const PriceDropSummarySchema = z.object({
  summary: z.string().describe('A short, exciting summary of the price drop.'),
});
export type PriceDropSummary = z.infer<typeof PriceDropSummarySchema>;

const EmailNotificationSchema = z.object({
    toEmail: z.string().email().describe('The email address to send the notification to.'),
    priceDrops: z.array(PriceDropInfoSchema).describe('A list of all detected price drops for this notification batch.')
});


// MongoDB Collection Names
const LATEST_CRUISES_COLLECTION = 'latestCruises';
const PRICE_DROPS_COLLECTION = 'priceDrops';

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

// Prompt for summarizing a single price drop
const priceDropEmailSummarizationPrompt = ai.definePrompt({
  name: 'priceDropEmailSummarizationPrompt',
  input: { schema: PriceDropInfoSchema },
  output: { schema: PriceDropSummarySchema },
  prompt: `You are an expert in creating exciting and informative summaries for price drops on cruises.

  Given the following information about a cruise price drop, generate a short, user-friendly summary that highlights the key details and potential savings. Emphasize the excitement of finding the best deal and direct it to an English audience, currency GBP. The date is already formatted correctly.

  Ship Name: {{{shipName}}}
  Cruise Date: {{{cruiseDate}}}
  Cabin Description: {{{gradeName}}} ({{{gradeCode}}})
  Package: {{{dealName}}}
  Vendor ID: {{{vendorId}}}
  Original Price: £{{{priceFrom}}}
  New Price: £{{{priceTo}}}

  Summary:`,
});

// Prompt for summarizing multiple price drops for a single email
const multiPriceDropEmailSummarizationPrompt = ai.definePrompt({
  name: 'multiPriceDropEmailSummarizationPrompt',
  input: { schema: EmailNotificationSchema },
  output: { schema: z.object({ subject: z.string(), body: z.string() }) },
  prompt: `You are an expert travel agent's assistant, tasked with creating a compelling email newsletter about recent cruise price drops. The audience is English, and currency is GBP. Dates are already formatted.

You have detected the following price drops:
{{#each priceDrops}}
- Ship: {{{shipName}}}, Date: {{{cruiseDate}}}, Cabin: {{{gradeName}}} ({{{gradeCode}}}), Package: {{{dealName}}}, Was: £{{{priceFrom}}}, Now: £{{{priceTo}}}
{{/each}}

Based on this data, write a friendly and exciting email for the recipient at {{{toEmail}}}.

The email should have two parts:
1.  **Subject Line**: Create a concise and catchy subject line that grabs attention.
2.  **Email Body**: Write an HTML email body. Start with a friendly greeting. Briefly mention that you've found some great deals. Then, present the price drops in a clear, easy-to-read format (e.g., a list or styled cards). Conclude with a warm sign-off from "The CruiseCatcher Team".
`,
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
        if (input.priceDrops.length === 0) {
            return { success: true }; // Nothing to send
        }
        
        // Generate the consolidated email content
        const { output: emailContent } = await multiPriceDropEmailSummarizationPrompt(input);
        if (!emailContent) {
             console.error('Failed to generate email content from AI prompt.');
             return { success: false };
        }
        
        const result = await sendEmailTool({
          to: input.toEmail,
          subject: emailContent.subject,
          body: emailContent.body
        });

        return { success: result.success };
    }
);


/**
 * Monitors the cruise API for price drops and triggers alerts.
 */
export const monitorPriceDrops = ai.defineFlow(
  {
    name: 'monitorPriceDrops',
  },
  async () => {
    const toEmail = process.env.NOTIFICATION_EMAIL;

    if (!toEmail) {
      console.log('Monitoring skipped: NOTIFICATION_EMAIL environment variable not set.');
      return;
    }

    const latestCruisesCollection = await getCollection('latestCruises');
    const priceDropsCollection = await getCollection('priceDrops');
    
    if (!latestCruisesCollection || !priceDropsCollection) {
        console.log('Monitoring skipped: Database not configured.');
        return;
    }
    
    console.log('Fetching current cruise prices...');
    const currentOfferings = await fetchCruises();
    
    if (!Array.isArray(currentOfferings)) {
      console.error('fetchCruises did not return an array. Aborting monitoring run.');
      return;
    }
    
    const previousCruisesDoc = await latestCruisesCollection.findOne({ _id: 'latest' } as any);
    const previousOfferings = (previousCruisesDoc?.offerings || []) as CruiseOffering[];

    console.log(`Found ${currentOfferings.length} current cruise offerings.`);
    console.log(`Found ${previousOfferings.length} previous offerings to compare against.`);
    
    const detectedDrops: PriceDropInfo[] = [];

    // Use a Map for efficient lookup of previous offerings
    const previousOfferingsMap = new Map<string, CruiseOffering>();
    for (const offering of previousOfferings) {
        previousOfferingsMap.set(offering.offering_id, offering);
    }

    if (previousOfferings.length > 0) {
      for (const current of currentOfferings) {
        const previous = previousOfferingsMap.get(current.offering_id);

        if (previous) {
            const currentPrice = parseFloat(current.price);
            const previousPrice = parseFloat(previous.price);

            // Check for a meaningful price drop (at least 1 cent)
            if (currentPrice > 0 && previousPrice > 0 && (previousPrice - currentPrice) >= 0.01) {
              console.log(`Price drop for ${current.ship_title} (${current.grade_name} / ${current.dealName})! Was ${previousPrice}, now ${currentPrice}`);
              const priceDropInfo: PriceDropInfo = {
                shipName: current.ship_title,
                cruiseDate: formatDateWithOrdinal(current.starts_on),
                vendorId: current.vendor_id,
                dealCode: current.dealCode,
                dealName: current.dealName,
                gradeCode: current.grade_code,
                gradeName: current.grade_name,
                priceFrom: previousPrice,
                priceTo: currentPrice,
                detectedAt: new Date().toISOString(),
              };
              detectedDrops.push(priceDropInfo);
            }
        }
      }
    }

    if (detectedDrops.length > 0) {
        console.log(`Found ${detectedDrops.length} new price drops. Saving and notifying...`);
        await priceDropsCollection.insertMany(detectedDrops as any);
        await sendPriceDropEmail({ toEmail, priceDrops: detectedDrops });

    } else {
        console.log("No price drops found on this run.");
    }

    if (currentOfferings.length > 0) {
        console.log('Saving current cruise offerings for next check...');
        await latestCruisesCollection.updateOne(
            { _id: 'latest' } as any,
            { $set: { offerings: currentOfferings } },
            { upsert: true }
        );
    } else {
        console.log('No new offerings to save. Keeping previous data.');
    }
    
    console.log('Monitoring complete.');
  }
);

// Flow to retrieve the latest price drop
export const getRecentPriceDrops = ai.defineFlow(
  {
    name: 'getRecentPriceDrops',
    description: 'Retrieves the most recent price drops.',
    outputSchema: z.array(PriceDropInfoSchema),
  },
  async () => {
    const priceDropsCollection = await getCollection<PriceDropInfo>(PRICE_DROPS_COLLECTION);
    
    if (!priceDropsCollection) {
        console.warn('MongoDB not configured. Cannot get recent price drops.');
        return [];
    }
    
    const docs = await priceDropsCollection
        .find()
        .sort({ detectedAt: -1 })
        .limit(10)
        .toArray();

    if (!docs || docs.length === 0) {
      return [];
    }

    // Filter out any documents that don't match the schema
    const validPriceDrops = docs.reduce((acc, doc) => {
        const { _id, ...rest } = doc as any; // Exclude MongoDB's _id
        const parsed = PriceDropInfoSchema.safeParse(rest);
        if (parsed.success) {
            acc.push(parsed.data);
        } else {
            console.warn("Skipping invalid price drop document:", parsed.error);
        }
        return acc;
    }, [] as PriceDropInfo[]);
    
    return validPriceDrops;
  }
);



