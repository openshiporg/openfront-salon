import { Metadata } from "next"
import Link from "next/link"
import { getAllStylists } from "../lib/data/stylists"
import { StylistCard } from "../components/StylistCard"
import { Users } from "lucide-react"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Our Team | Openfront Salon",
    description: "Meet our talented team of professional stylists and beauty experts. Book with your favorite stylist today.",
  }
}

export async function TeamPage() {
  const stylists = await getAllStylists()

  // Group stylists by tier
  const stylistsByTier = stylists.reduce((acc, stylist) => {
    const tier = stylist.tier || "junior"
    if (!acc[tier]) acc[tier] = []
    acc[tier].push(stylist)
    return acc
  }, {} as Record<string, typeof stylists>)

  const tierOrder = ["master", "senior", "junior"]
  const tierLabels: Record<string, string> = {
    master: "Master Stylists",
    senior: "Senior Stylists",
    junior: "Junior Stylists",
    director: "Creative Directors"
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 to-primary/5 py-16 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-4">Meet Our Team</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Our talented stylists are passionate about bringing your vision to life. Each member of our team brings unique skills and expertise to deliver exceptional results.
            </p>
          </div>
        </div>
      </section>

      {/* Team Members */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {stylists.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Team Members Yet</h3>
              <p className="text-muted-foreground mb-6">
                Our team will be available soon. Check back later!
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition-all"
              >
                Back to Home
              </Link>
            </div>
          ) : (
            <div className="space-y-16">
              {tierOrder.map((tier) => {
                const teamMembers = stylistsByTier[tier]
                if (!teamMembers || teamMembers.length === 0) return null

                return (
                  <div key={tier}>
                    <div className="mb-8">
                      <h2 className="text-3xl font-bold mb-2">{tierLabels[tier]}</h2>
                      <p className="text-muted-foreground">
                        {tier === "master" && "Our most experienced professionals with advanced training"}
                        {tier === "senior" && "Highly skilled stylists with years of expertise"}
                        {tier === "junior" && "Talented stylists with fresh perspectives and techniques"}
                      </p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {teamMembers.map((stylist) => (
                        <StylistCard key={stylist.id} stylist={stylist} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Book?</h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Choose your stylist and book your appointment today
          </p>
          <Link
            href="/book"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-8 py-3 text-lg font-medium hover:bg-primary/90 transition-all"
          >
            Book an Appointment
          </Link>
        </div>
      </section>
    </div>
  )
}
