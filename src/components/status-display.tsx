"use client";

import { useState, useEffect } from "react";
import { Activity, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function StatusDisplay() {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    const updateCheckTime = () => setLastChecked(new Date());
    updateCheckTime();
    
    const intervalId = setInterval(updateCheckTime, 15 * 60 * 1000); // Mock check every 15 mins

    return () => clearInterval(intervalId);
  }, []);

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
          <p>The service is checking for price drops every 15 minutes.</p>
          {lastChecked ? (
            <p>Last check: {lastChecked.toLocaleString()}</p>
          ) : (
            <p>Last check: Initializing...</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
