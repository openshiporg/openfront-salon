import { NextResponse } from "next/server";
import { keystoneContext } from "@/features/keystone/context";
import { reconcilePaymentWebhook } from "@/features/keystone/payment-webhook";

const MAX_WEBHOOK_BYTES = 1_000_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!/^pp_[a-z0-9_-]+$/.test(provider)) {
    return NextResponse.json({ error: "Webhook provider not found" }, { status: 404 });
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 });
  }

  const payload = await request.text();
  if (Buffer.byteLength(payload) > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 });
  }

  try {
    const outcome = await reconcilePaymentWebhook(keystoneContext, provider, payload, {
      "stripe-signature": request.headers.get("stripe-signature") || undefined,
      "content-type": request.headers.get("content-type") || undefined,
    });
    return NextResponse.json({ received: true, ...outcome });
  } catch (error) {
    console.error("Payment webhook rejected", {
      provider,
      message: error instanceof Error ? error.message : "Unknown webhook error",
    });
    return NextResponse.json({ error: "Invalid payment webhook" }, { status: 400 });
  }
}
