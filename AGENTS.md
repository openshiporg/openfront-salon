# Rules

NEVER build outbox, texting/email notification machinery, cron, worker services, or setInterval/setTimeout loops in `instrumentation.ts` into this Openfront. Time-based state is computed on read, advanced idempotently on the request that touches it, or advanced by a staff button. External events go only through Openfront Commerce webhooks (`openfront/features/webhooks`). Reports are Export buttons; invites are copyable links.
