import { Header } from "@/components/header";
import { StatusDisplay } from "@/components/status-display";
import { PriceDropAlert } from "@/components/price-drop-alert";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <StatusDisplay />
          </div>
          <div className="lg:col-span-2">
            <PriceDropAlert />
          </div>
        </div>
      </main>
    </div>
  );
}
