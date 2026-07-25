"use client";

import { RouteErrorState } from "@/components/RouteErrorState";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorState reset={reset} variant="dashboard" />;
}
