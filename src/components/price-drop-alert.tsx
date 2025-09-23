"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { generateSummaryAction } from "@/lib/actions";
import type { PriceDropInfo } from "@/ai/flows/price-drop-email-summarization";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Ship,
  Calendar,
  ArrowRight,
  Sparkles,
  Bell,
  Mail,
} from "lucide-react";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Mock data for a price drop event
const mockPriceDrop: PriceDropInfo = {
  shipName: "Oceanic Wonder",
  cruiseDate: "2024-12-15",
  vendorId: "MSC-OW-121524",
  priceFrom: 2499,
  priceTo: 1999,
};

export function PriceDropAlert() {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      setError(null);
      const result = await generateSummaryAction(mockPriceDrop);
      if (result.success) {
        setSummary(result.summary);
      } else {
        setError(result.error || "An unknown error occurred.");
      }
      setIsLoading(false);
    };

    fetchSummary();
  }, []);

  const cruiseImage = PlaceHolderImages.find((img) => img.id === "cruise-ship");

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <Bell className="h-6 w-6 text-accent" />
          Latest Price Drop
        </CardTitle>
        <CardDescription>
          We've detected a price reduction on a cruise!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative aspect-[3/2] w-full rounded-lg overflow-hidden">
          {cruiseImage ? (
            <Image
              src={cruiseImage.imageUrl}
              alt={cruiseImage.description}
              fill
              className="object-cover"
              data-ai-hint={cruiseImage.imageHint}
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Ship className="h-5 w-5 text-muted-foreground" />
            <span>
              <strong>Ship:</strong> {mockPriceDrop.shipName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span>
              <strong>Date:</strong> {mockPriceDrop.cruiseDate}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 rounded-lg border bg-card p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">From</p>
            <p className="text-2xl font-bold line-through">
              ${mockPriceDrop.priceFrom}
            </p>
          </div>
          <ArrowRight className="h-6 w-6 text-accent shrink-0" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Now</p>
            <p className="text-3xl font-bold text-accent">
              ${mockPriceDrop.priceTo}
            </p>
          </div>
        </div>

        <Separator />
        
        <div>
          <h3 className="font-headline text-lg flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Generated Summary
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : (
            <p className="text-foreground/90 italic border-l-4 border-primary pl-4 py-2 bg-primary/5 rounded-r-md">
              {summary}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="outline">
          <Mail className="mr-2 h-4 w-4" />
          Send Email Notification
        </Button>
      </CardFooter>
    </Card>
  );
}
