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
  cabinGrade: z.string().describe('The cabin grade for which the price dropped (e.g., Inside, Balcony).'),
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

  Given the following information about a cruise price drop, generate a short, user-friendly summary that highlights the key details and potential savings. Emphasize the excitement of finding the best deal and direct it to an English audience, currency GBP and date format DD/MM/YYYY.

  Ship Name: {{{shipName}}}
  Cruise Date: {{{cruiseDate}}}
  Cabin Grade: {{{cabinGrade}}}
  Vendor ID: {{{vendorId}}}
  Original Price: {{{priceFrom}}}
  New Price: {{{priceTo}}}

  Summary:`,
});

// Prompt for summarizing multiple price drops for a single email
const multiPriceDropEmailSummarizationPrompt = ai.definePrompt({
  name: 'multiPriceDropEmailSummarizationPrompt',
  input: { schema: EmailNotificationSchema },
  output: { schema: z.object({ subject: z.string(), body: z.string() }) },
  prompt: `You are an expert travel agent's assistant, tasked with creating a compelling email newsletter about recent cruise price drops. The audience is English, and currency is GBP.

You have detected the following price drops:
{{#each priceDrops}}
- Ship: {{{shipName}}}, Date: {{{cruiseDate}}}, Cabin: {{{cabinGrade}}}, Was: £{{{priceFrom}}}, Now: £{{{priceTo}}}
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
    const priceDropsCollection = await getCollection(PRICE_DROPS_COLLECTION);
    
    if (!latestCruisesCollection || !priceDropsCollection) {
        console.log('Monitoring skipped: Database not configured.');
        return;
    }
    
    console.log('Fetching current cruise prices...');
    const currentCruises = await fetchCruises();
    
    const previousCruisesDoc = await latestCruisesCollection.findOne({ _id: 'latest' });
    const previousCruises = (previousCruisesDoc ? previousCruisesDoc.cruises : []) as Cruise[];

    console.log(`Found ${currentCruises.length} current cruises.`);
    console.log(`Found ${previousCruises.length} previous cruises to compare against.`);
    
    const detectedDrops: PriceDropInfo[] = [];
    const cabinGrades: (keyof Cruise)[] = ['inside_price', 'outside_price', 'balcony_price', 'suite_price'];

    if (previousCruises.length > 0) {
      for (const currentCruise of currentCruises) {
        const previousCruise = previousCruises.find(
          (c) => c.vendor_id === currentCruise.vendor_id
        );

        if (previousCruise) {
          for (const grade of cabinGrades) {
            const currentPrice = parseFloat(currentCruise[grade]);
            const previousPrice = parseFloat(previousCruise[grade]);
            const gradeName = grade.replace('_price', '').replace(/^\w/, c => c.toUpperCase());

            if (currentPrice > 0 && previousPrice > 0 && currentPrice < previousPrice) {
              console.log(`Price drop for ${currentCruise.name} (${gradeName})! Was ${previousPrice}, now ${currentPrice}`);
              const priceDropInfo: PriceDropInfo = {
                shipName: currentCruise.ship_title,
                cruiseDate: formatDateWithOrdinal(currentCruise.starts_on),
                vendorId: currentCruise.vendor_id,
                cabinGrade: gradeName,
                priceFrom: previousPrice,
                priceTo: currentPrice,
                detectedAt: new Date().toISOString(),
              };
              detectedDrops.push(priceDropInfo);
            }
          }
        }
      }
    }

    if (detectedDrops.length > 0) {
        console.log(`Found ${detectedDrops.length} new price drops. Saving and notifying...`);
        // Save all new price drops to the database
        await priceDropsCollection.insertMany(detectedDrops as any);

        // Send one consolidated email for all drops
        await sendPriceDropEmail({ toEmail, priceDrops: detectedDrops });

    } else {
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
    
    // Fetch the 10 most recent documents, sorted by detection time
    const docs = await priceDropsCollection
        .find()
        .sort({ detectedAt: -1 })
        .limit(10)
        .toArray();

    if (!docs || docs.length === 0) {
      return [];
    }

    // Filter out any documents that don't match the schema and remove _id
    const validPriceDrops = docs.reduce((acc, doc) => {
        const { _id, ...rest } = doc as any;
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
