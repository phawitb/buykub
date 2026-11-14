import { redirect } from "next/navigation";

// Keep the original service and booking data for a future relaunch.
export default function BookingsLayout() {
  redirect("/dashboard/products");
}
