"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import { generateSummaryAction, sendEmailAction, getLatestPriceDropAction } from "@/lib/actions";
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
  Loader2,
  Check,
  Info,
} from "lucide-react";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function PriceDropAlert() {
  const [priceDrop, setPriceDrop] = useState<PriceDropInfo | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSendingEmail, startEmailTransition] = useTransition();
  const [isEmailSuccess, setIsEmailSuccess] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchLatestDrop = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const dropResult = await getLatestPriceDropAction();

        if (dropResult.success) {
          if (dropResult.data) {
            setPriceDrop(dropResult.data);
            const summaryResult = await generateSummaryAction(dropResult.data);
            if (summaryResult.success) {
              setSummary(summaryResult.summary);
            } else {
              setError(summaryResult.error || "Failed to generate summary.");
            }
          }
          // If dropResult.data is null, it means no price drop has been detected yet.
          // The component will render a message for this state, so no action is needed here.
        } else {
          setError(dropResult.error || "Failed to fetch latest price drop.");
        }
      } catch (e) {
        setError("An unexpected error occurred while fetching data.");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestDrop();
  }, []);

  const handleSendEmail = () => {
    if (!priceDrop) return;
    startEmailTransition(async () => {
      const result = await sendEmailAction(priceDrop);
      if (result.success) {
        setIsEmailSuccess(true);
        toast({
          title: "Success",
          description: "Email notification sent successfully!",
        });
        setTimeout(() => setIsEmailSuccess(false), 2000);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error,
        });
      }
    });
  };

  const cruiseImage = PlaceHolderImages.find((img) => img.id === "cruise-ship");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="aspect-[3/2] w-full rounded-lg" />
          <div className="space-y-4 mt-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-10 w-full" />
            <Separator />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Bell className="h-6 w-6 text-accent" />
            Latest Price Drop
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!priceDrop) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Bell className="h-6 w-6 text-accent" />
            Latest Price Drop
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Price Drops Yet</AlertTitle>
            <AlertDescription>
              The agent is actively monitoring for new price drops. We'll display the latest one here as soon as it's detected.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

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
              <strong>Ship:</strong> {priceDrop.shipName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span>
              <strong>Date:</strong> {priceDrop.cruiseDate}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 rounded-lg border bg-card p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">From</p>
            <p className="text-2xl font-bold line-through">
              ${priceDrop.priceFrom}
            </p>
          </div>
          <ArrowRight className="h-6 w-6 text-accent shrink-0" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Now</p>
            <p className="text-3xl font-bold text-accent">
              ${priceDrop.priceTo}
            </p>
          </div>
        </div>

        <Separator />
        
        <div>
          <h3 className="font-headline text-lg flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Generated Summary
          </h3>
          {!summary ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <p className="text-foreground/90 italic border-l-4 border-primary pl-4 py-2 bg-primary/5 rounded-r-md">
              {summary}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleSendEmail} disabled={isSendingEmail || isEmailSuccess}>
          {isSendingEmail ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
          ) : isEmailSuccess ? (
            <><Check className="mr-2 h-4 w-4" /> Sent!</>
          ) : (
            <><Mail className="mr-2 h-4 w-4" /> Notify Me of This Drop</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
