import type { SVGProps } from "react";

export function CruiseCatcherLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 12h20" />
      <path d="M4 12v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4" />
      <path d="m12 12-2-3-2 3" />
      <path d="m18 12-2-3-2 3" />
      <path d="M6 12-2 7" />
      <path d="m18 12 4-5" />
      <path d="M12 4s-1-1-2-1-2 1-2 1" />
    </svg>
  );
}
