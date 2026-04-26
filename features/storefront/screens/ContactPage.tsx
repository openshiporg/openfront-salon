import { Metadata } from "next"
import Link from "next/link"
import { MapPin, Phone, Mail, Clock, Calendar, Instagram, Facebook, Twitter, Send } from "lucide-react"

export const generateContactMetadata: Metadata = {
  title: "Contact Us - Openfront Salon",
  description: "Get in touch with Openfront Salon. Visit us, call, or send us a message. We're here to help with all your beauty needs.",
}

const HOURS = [
  { day: "Monday", hours: "9:00 AM - 8:00 PM" },
  { day: "Tuesday", hours: "9:00 AM - 8:00 PM" },
  { day: "Wednesday", hours: "9:00 AM - 8:00 PM" },
  { day: "Thursday", hours: "9:00 AM - 9:00 PM" },
  { day: "Friday", hours: "9:00 AM - 9:00 PM" },
  { day: "Saturday", hours: "8:00 AM - 6:00 PM" },
  { day: "Sunday", hours: "10:00 AM - 5:00 PM" },
]

export function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">Get in Touch</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We&apos;d love to hear from you. Visit us, call, or send us a message.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Contact Information */}
            <div className="space-y-6">
              {/* Location */}
              <div className="bg-card border rounded-lg shadow-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-2">Location</h2>
                    <p className="text-muted-foreground mb-4">
                      123 Beauty Boulevard<br />
                      Suite 100<br />
                      New York, NY 10001
                    </p>
                    <a
                      href="https://maps.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                    >
                      Get Directions
                      <Send className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div className="bg-card border rounded-lg shadow-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-2">Phone</h2>
                    <a
                      href="tel:+15551234567"
                      className="text-lg text-muted-foreground hover:text-primary transition-colors"
                    >
                      (555) 123-4567
                    </a>
                    <p className="text-sm text-muted-foreground mt-2">
                      Call us to book or inquire about our services
                    </p>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="bg-card border rounded-lg shadow-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-2">Email</h2>
                    <a
                      href="mailto:hello@openfrontsalon.com"
                      className="text-lg text-muted-foreground hover:text-primary transition-colors"
                    >
                      hello@openfrontsalon.com
                    </a>
                    <p className="text-sm text-muted-foreground mt-2">
                      Send us a message anytime
                    </p>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="bg-card border rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">Follow Us</h2>
                <div className="flex gap-4">
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-6 h-6 text-primary" />
                  </a>
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                    aria-label="Facebook"
                  >
                    <Facebook className="w-6 h-6 text-primary" />
                  </a>
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                    aria-label="Twitter"
                  >
                    <Twitter className="w-6 h-6 text-primary" />
                  </a>
                </div>
              </div>
            </div>

            {/* Hours of Operation */}
            <div className="space-y-6">
              <div className="bg-card border rounded-lg shadow-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">Hours of Operation</h2>
                </div>
                <div className="space-y-3">
                  {HOURS.map((schedule) => {
                    const isToday = new Date().toLocaleDateString("en-US", { weekday: "long" }) === schedule.day
                    return (
                      <div
                        key={schedule.day}
                        className={`flex justify-between items-center py-3 px-4 rounded-lg ${
                          isToday ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
                        }`}
                      >
                        <span className={`font-medium ${isToday ? "text-primary" : ""}`}>
                          {schedule.day}
                          {isToday && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                              Today
                            </span>
                          )}
                        </span>
                        <span className={`text-muted-foreground ${isToday ? "text-foreground font-medium" : ""}`}>
                          {schedule.hours}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> Hours may vary on holidays. Please call ahead to confirm.
                  </p>
                </div>
              </div>

              {/* Quick Book CTA */}
              <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-lg shadow-lg p-8">
                <div className="text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Ready to Book?</h3>
                  <p className="text-primary-foreground/90 mb-6">
                    Schedule your appointment online 24/7
                  </p>
                  <Link
                    href="/book"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-background text-foreground px-8 py-3 font-medium hover:bg-background/90 transition-all shadow-lg"
                  >
                    <Calendar className="h-5 w-5" />
                    Book Appointment
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Map Placeholder */}
          <div className="bg-card border rounded-lg shadow-lg overflow-hidden">
            <div className="bg-muted/50 border-b p-4">
              <h2 className="text-xl font-bold">Find Us</h2>
            </div>
            <div className="relative h-96 bg-muted/30 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Map integration coming soon</p>
                <a
                  href="https://maps.google.com/?q=123+Beauty+Boulevard,Suite+100,New+York,NY+10001"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  Open in Google Maps
                  <Send className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* FAQs or Additional Info */}
          <div className="mt-12 bg-muted/30 border rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Do I need an appointment?</h3>
                <p className="text-sm text-muted-foreground">
                  While walk-ins are welcome, we highly recommend booking an appointment to ensure availability and minimize wait times.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">What is your cancellation policy?</h3>
                <p className="text-sm text-muted-foreground">
                  Please notify us at least 24 hours in advance if you need to cancel or reschedule your appointment.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
                <p className="text-sm text-muted-foreground">
                  We accept cash, all major credit cards, and digital payment methods including Apple Pay and Google Pay.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Do you offer gift cards?</h3>
                <p className="text-sm text-muted-foreground">
                  Yes! Gift cards are available for purchase online or in-salon. Visit our <Link href="/gift-cards" className="text-primary hover:underline">gift cards page</Link> to learn more.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
