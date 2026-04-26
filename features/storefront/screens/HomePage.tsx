import { Metadata } from "next"
import Link from "next/link"
import { Calendar, Clock, Star, Award, ArrowRight, Sparkles } from "lucide-react"
import { getServicesGroupedByCategory, getFeaturedServices } from "../lib/data/services"
import { getAllStylists } from "../lib/data/stylists"
import { ServiceCard } from "../components/ServiceCard"
import { StylistCard } from "../components/StylistCard"
import { CategoryCard } from "../components/CategoryCard"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Openfront Salon | Premium Hair, Beauty & Wellness Services",
    description: "Book appointments for hair styling, nail care, skincare, and massage services at our full-service salon. Expert stylists, modern techniques, and a relaxing atmosphere.",
  }
}

export async function HomePage() {
  const [categories, featuredServices, stylists] = await Promise.all([
    getServicesGroupedByCategory(),
    getFeaturedServices(4),
    getAllStylists()
  ])

  const topStylists = stylists.filter(s => s.isActive).slice(0, 4)

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/90 to-primary text-primary-foreground py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/salon-pattern.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm mb-6">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Premium Salon Experience</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Your Beauty,
              <br />
              <span className="text-primary-foreground/90">Our Passion</span>
            </h1>
            <p className="text-xl lg:text-2xl mb-8 text-primary-foreground/90">
              Expert hair styling, nail care, skincare, and wellness services
              in a modern, relaxing environment
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/book"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-background text-foreground px-8 py-4 text-lg font-medium hover:bg-background/90 transition-all shadow-lg hover:shadow-xl"
              >
                <Calendar className="h-5 w-5" />
                Book Appointment
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary-foreground/20 backdrop-blur-sm bg-primary-foreground/10 px-8 py-4 text-lg font-medium hover:bg-primary-foreground/20 transition-all"
              >
                View Services
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Award className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Expert Stylists</h3>
              <p className="text-muted-foreground">
                Our talented team brings years of experience and ongoing training
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Easy Booking</h3>
              <p className="text-muted-foreground">
                Book online 24/7 and get instant confirmation for your appointment
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Star className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Premium Products</h3>
              <p className="text-muted-foreground">
                We use only the finest professional-grade products and techniques
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Service Categories */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Our Services</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover our full range of professional beauty and wellness services
            </p>
          </div>
          {categories.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Service categories coming soon</p>
            </div>
          )}
        </div>
      </section>

      {/* Featured Services */}
      {featuredServices.length > 0 && (
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Popular Services</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Our most-booked treatments
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredServices.map((service) => (
                <ServiceCard key={service.id} service={service} showCategory />
              ))}
            </div>
            <div className="text-center mt-8">
              <Link
                href="/services"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition-all"
              >
                View All Services
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Meet Our Team */}
      {topStylists.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Meet Our Team</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Talented professionals dedicated to making you look and feel your best
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {topStylists.map((stylist) => (
                <StylistCard key={stylist.id} stylist={stylist} />
              ))}
            </div>
            <div className="text-center mt-8">
              <Link
                href="/team"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition-all"
              >
                View Full Team
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/90 to-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Look?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto text-primary-foreground/90">
            Book your appointment today and experience the difference of professional salon services
          </p>
          <Link
            href="/book"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-background text-foreground px-8 py-4 text-lg font-medium hover:bg-background/90 transition-all shadow-lg hover:shadow-xl"
          >
            <Calendar className="h-5 w-5" />
            Book Now
          </Link>
        </div>
      </section>
    </div>
  )
}
