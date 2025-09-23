import { CruiseCatcherLogo } from "@/components/icons";

export function Header() {
  return (
    <header className="bg-primary text-primary-foreground py-4 px-6 shadow-md">
      <div className="container mx-auto flex items-center gap-4">
        <CruiseCatcherLogo className="h-8 w-8 text-accent" />
        <h1 className="text-3xl font-headline tracking-wider">
          CruiseCatcher
        </h1>
      </div>
    </header>
  );
}
