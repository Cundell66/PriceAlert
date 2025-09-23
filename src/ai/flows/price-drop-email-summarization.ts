'use server';
/**
 * @fileOverview Summarizes price drop details for email notifications.
 *
 * - summarizePriceDrop - A function that summarizes price drop information.
 * - PriceDropInfo - The input type for the summarizePriceDrop function.
 * - PriceDropSummary - The return type for the summarizePriceDrop function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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

export async function summarizePriceDrop(priceDropInfo: PriceDropInfo): Promise<PriceDropSummary> {
  return priceDropEmailSummarizationFlow(priceDropInfo);
}

const priceDropEmailSummarizationPrompt = ai.definePrompt({
  name: 'priceDropEmailSummarizationPrompt',
  input: {schema: PriceDropInfoSchema},
  output: {schema: PriceDropSummarySchema},
  prompt: `You are an expert in creating exciting and informative summaries for price drops on cruises.

  Given the following information about a cruise price drop, generate a short, user-friendly summary that highlights the key details and potential savings. Emphasize the excitement of finding the best deal.

  Ship Name: {{{shipName}}}
  Cruise Date: {{{cruiseDate}}}
  Vendor ID: {{{vendorId}}}
  Original Price: {{{priceFrom}}}
  New Price: {{{priceTo}}}

  Summary:`,
});

const priceDropEmailSummarizationFlow = ai.defineFlow(
  {
    name: 'priceDropEmailSummarizationFlow',
    inputSchema: PriceDropInfoSchema,
    outputSchema: PriceDropSummarySchema,
  },
  async input => {
    const {output} = await priceDropEmailSummarizationPrompt(input);
    return output!;
  }
);
