import type { Metadata } from "next";
import { storefrontTitle } from "@/features/storefront/lib/data/brand";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Book an appointment") };
}

export { BookingPageServer as default } from '@/features/storefront/screens/BookingPageServer';
