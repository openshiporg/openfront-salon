"use server";
import { requestSalon } from "../session-client";
import { bookingPolicy } from "@/features/keystone/bookingPolicy";
import { resolveBookingContextRead, type BookingContextRead } from "./bookingSelectionRead";

export async function getBookingContext(): Promise<BookingContextRead> {
  try {
    const data = await requestSalon<{ locations?: unknown; authenticatedItem?: unknown }>(`query BookingContext { locations(where: { isActive: { equals: true } }, take: 50) { id name timezone } authenticatedItem { ... on User { id name email phone } } }`);
    return resolveBookingContextRead(true, data, bookingPolicy());
  } catch {
    return { status: "unavailable" };
  }
}
