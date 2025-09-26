"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import { generateSummaryAction, sendEmailAction, getRecentPriceDropsAction } from "@/lib/actions";
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
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from "@/components/ui/carousel";
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

function SinglePriceDropCard({ priceDrop }: { priceDrop: PriceDropInfo }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isSendingEmail, startEmailTransition] = useTransition();
  const [isEmailSuccess, setIsEmailSuccess] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const generateSummary = async () => {
      setIsSummaryLoading(true);
      const summaryResult = await generateSummaryAction(priceDrop);
      if (summaryResult.success) {
        setSummary(summaryResult.summary);
      }
      setIsSummaryLoading(false);
    };
    generateSummary();
  }, [priceDrop]);

  const handleSendEmail = () => {
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

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <Ship className="h-5 w-5 text-muted-foreground" />
          {priceDrop.shipName}
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {priceDrop.cruiseDate}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 flex-grow">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 rounded-lg border bg-card p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">From</p>
            <p className="text-2xl font-bold line-through">
              £{priceDrop.priceFrom.toFixed(2)}
            </p>
          </div>
          <ArrowRight className="h-6 w-6 text-accent shrink-0" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Now</p>
            <p className="text-3xl font-bold text-accent">
              £{priceDrop.priceTo.toFixed(2)}
            </p>
          </div>
        </div>
        <div>
          <h3 className="font-headline text-lg flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Generated Summary
          </h3>
          {isSummaryLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <p className="text-foreground/90 italic border-l-4 border-primary pl-4 py-2 bg-primary/5 rounded-r-md">
              {summary}
            </p>
          )}
        </div>
      </CardContent>
       <CardFooter className="flex-col items-stretch gap-4">
        <Button className="w-full" onClick={handleSendEmail} disabled={isSendingEmail || isEmailSuccess}>
          {isSendingEmail ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
          ) : isEmailSuccess ? (
            <><Check className="mr-2 h-4 w-4" /> Sent!</>
          ) : (
            <><Mail className="mr-2 h-4 w-4" /> Notify Me</>
          )}
        </Button>
         <p className="text-xs text-muted-foreground text-center">
            Drop detected on: {new Date(priceDrop.detectedAt).toLocaleDateString('en-GB')}
        </p>
      </CardFooter>
    </Card>
  );
}


export function PriceDropAlert() {
  const [priceDrops, setPriceDrops] = useState<PriceDropInfo[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const fetchRecentDrops = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const dropResult = await getRecentPriceDropsAction();

        if (dropResult.success) {
           setPriceDrops(dropResult.data || []);
        } else {
          setError(dropResult.error || "Failed to fetch recent price drops.");
        }
      } catch (e) {
        if (e instanceof Error) {
            setError(`An unexpected error occurred: ${e.message}`);
        } else {
            setError("An unexpected error occurred while fetching data.");
        }
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentDrops();
  }, []);

  useEffect(() => {
    if (!api) {
      return
    }
 
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap() + 1)
 
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1)
    })
  }, [api])


  const cruiseImage = PlaceHolderImages.find((img) => img.id === "cruise-ship");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mt-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-10 w-full" />
            <Separator />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Bell className="h-6 w-6 text-accent" />
            Recent Price Drops
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

  if (!priceDrops || priceDrops.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Bell className="h-6 w-6 text-accent" />
            Recent Price Drops
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Price Drops Yet</AlertTitle>
            <AlertDescription>
              The agent is actively monitoring for new price drops. We'll display recent ones here as soon as they're detected.
            </AlertDescription>
          </Alert>
          <div className="relative aspect-[3/2] w-full rounded-lg overflow-hidden mb-6">
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
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
        <div className="flex items-center justify-between mb-4">
            <CardTitle className="font-headline flex items-center gap-2">
            <Bell className="h-6 w-6 text-accent" />
            Recent Price Drops
            </CardTitle>
            {priceDrops.length > 1 && (
                 <div className="text-sm text-muted-foreground">
                    {current} of {count}
                </div>
            )}
        </div>
        <Carousel setApi={setApi} className="w-full">
            <CarouselContent>
            {priceDrops.map((drop, index) => (
                <CarouselItem key={index}>
                    <SinglePriceDropCard priceDrop={drop} />
                </CarouselItem>
            ))}
            </CarouselContent>
            {priceDrops.length > 1 && (
                <>
                    <CarouselPrevious className="hidden sm:flex" />
                    <CarouselNext className="hidden sm:flex" />
                </>
            )}
        </Carousel>
    </div>
  );
}
