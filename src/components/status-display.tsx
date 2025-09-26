"use client";

import { useState, useEffect, useTransition } from "react";
import { Activity, Info, Mail, Loader2, Check, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { sendEmailAction, runCronJobAction } from "@/lib/actions";
import { Separator } from "@/components/ui/separator";

export function StatusDisplay() {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isSending, startSendTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isChecking, startCheckTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    // This function runs only on the client-side
    const updateCheckTime = () => setLastChecked(new Date());
    updateCheckTime(); // Set initial time
    
    // This is a mock interval for display purposes.
    // The actual cron job runs on the server every 15 minutes.
    const intervalId = setInterval(updateCheckTime, 15 * 60 * 1000); 

    return () => clearInterval(intervalId);
  }, []);

  const handleRunCron = () => {
    startCheckTransition(async () => {
      const result = await runCronJobAction();
      if (result.success) {
        toast({
          title: "Success!",
          description: "Price check completed. The page will now refresh to show any new price drops.",
        });
        // Refresh the page to see the new data
        window.location.reload();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to run price check.",
        });
      }
    });
  }

  const handleSendTestEmail = () => {
    startSendTransition(async () => {
      const testData = {
        shipName: "Imaginary Voyager",
        cruiseDate: new Date().toLocaleDateString('en-GB'),
        vendorId: "TEST-001",
        priceFrom: 1000,
        priceTo: 800
      };

      const result = await sendEmailAction(testData);

      if (result.success) {
        setIsSuccess(true);
        toast({
          title: "Success!",
          description: "Test email sent. Please check your inbox.",
        });
        setTimeout(() => setIsSuccess(false), 2000);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to send test email.",
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <Info className="h-6 w-6" />
          Monitoring Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent" />
          <p className="font-semibold text-foreground">Monitoring Active</p>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>The service is checking for price drops every 15 minutes on the server.</p>
          {lastChecked ? (
            <p>UI last updated: {lastChecked.toLocaleString()}</p>
          ) : (
            <p>UI last updated: Initializing...</p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-4">
        <Button className="w-full" onClick={handleRunCron} disabled={isChecking}>
          {isChecking ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...</>
          ) : (
            <><RefreshCw className="mr-2 h-4 w-4" /> Run Price Check Now</>
          )}
        </Button>
        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">For Testing</span>
          <Separator className="flex-1" />
        </div>
        <Button className="w-full" variant="outline" onClick={handleSendTestEmail} disabled={isSending}>
          {isSending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
          ) : isSuccess ? (
            <><Check className="mr-2 h-4 w-4" /> Sent!</>
          ) : (
            <><Mail className="mr-2 h-4 w-4" /> Send Test Email</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
