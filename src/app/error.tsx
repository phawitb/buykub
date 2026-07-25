"use client";

import { RouteErrorState } from "@/components/RouteErrorState";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorState reset={reset} />;
}
