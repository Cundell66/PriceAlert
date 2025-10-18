
"use client";

import { useState, useEffect } from 'react';
import { getComparisonDataAction } from '@/lib/actions';
import type { CruiseOffering } from '@/lib/cruise-api';
import type { ComparisonData } from '@/ai/flows/price-drop-email-summarization';
import { Header } from '@/components/header';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Info, AlertCircle } from 'lucide-react';

function CruiseDataTable({ offerings, title, date }: { offerings: CruiseOffering[], title: string, date?: string }) {
  const formattedDate = date ? new Date(date).toLocaleString('en-GB') : 'N/A';

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-4 border-b">
        <h2 className="text-xl font-headline">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {offerings.length} offerings | Last Updated: {formattedDate}
        </p>
      </div>
      <ScrollArea className="h-[60vh]">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-[350px]">Offering ID</TableHead>
              <TableHead>Ship</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Deal</TableHead>
              <TableHead>Cabin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offerings.map(offering => (
              <TableRow key={offering.offering_id}>
                <TableCell className="font-mono text-xs">{offering.offering_id}</TableCell>
                <TableCell>{offering.ship_title}</TableCell>
                <TableCell>£{offering.price}</TableCell>
                <TableCell>{offering.dealName}</TableCell>
                <TableCell>{offering.grade_name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

export default function ManualComparisonPage() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const result = await getComparisonDataAction();
      if (result.success && result.data) {
        // Sort data for easier comparison
        result.data.latest.sort((a, b) => a.offering_id.localeCompare(b.offering_id));
        result.data.previous.sort((a, b) => a.offering_id.localeCompare(b.offering_id));
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch comparison data.');
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-headline mb-6">Manual Data Comparison</h1>
        
        {isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Skeleton className="h-[70vh] w-full" />
                <Skeleton className="h-[70vh] w-full" />
            </div>
        )}

        {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        {!isLoading && !error && !data?.latest.length && !data?.previous.length && (
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>No Data Found</AlertTitle>
                <AlertDescription>
                Neither the 'latest' nor 'previous' cruise data collections contain any data. Run the price check at least once to populate them.
                </AlertDescription>
          </Alert>
        )}
        
        {!isLoading && !error && data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <CruiseDataTable offerings={data.latest} title="Latest Data" date={data.latestDate} />
            <CruiseDataTable offerings={data.previous} title="Previous Data" date={data.previousDate} />
          </div>
        )}
      </main>
    </div>
  );
}
