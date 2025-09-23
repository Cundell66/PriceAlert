"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Settings, Save, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState, useTransition } from "react";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
});

const hardcodedHeaders = {
  "Accept": "application/json;api_version=2",
  "User-Agent": "CruiseAboardTracker/1.2"
};

export function ConfigurationForm() {
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(() => {
      // In a real app, you would save these values to a secure backend.
      const configuration = {
        apiUrl: process.env.API_ENDPOINT_URL,
        headers: hardcodedHeaders,
        email: values.email
      }
      console.log(configuration);
      return new Promise(resolve => setTimeout(() => {
        setIsSuccess(true);
        resolve(true);
        setTimeout(() => setIsSuccess(false), 2000);
      }, 1000));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <Settings className="h-6 w-6" />
          Configuration
        </CardTitle>
        <CardDescription>
          Enter your email for price drop notifications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notification Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isPending || isSuccess}>
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : isSuccess ? (
                <><Check className="mr-2 h-4 w-4" /> Saved!</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Save Configuration</>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
