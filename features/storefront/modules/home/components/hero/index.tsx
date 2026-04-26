import Link from "next/link"

interface HeroProps {
  title?: string
  description?: string
}

export default function Hero({ title, description }: HeroProps) {
  return (
    <section className="relative bg-gradient-to-b from-primary/10 to-background">
      <div className="container mx-auto px-4 py-24 md:py-32">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            {title || "Experience Professional Beauty Services"}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            {description || "Book appointments with our expert stylists for haircuts, color treatments, nails, skincare, and more."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/book"
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Book Appointment
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-base font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              View Services
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
