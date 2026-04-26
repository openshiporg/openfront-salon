import Link from "next/link"
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin, Sparkles } from "lucide-react"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/30">
      <div className="container px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center space-x-2 mb-4 group">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <span className="font-bold text-lg">Openfront Salon</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              Your beauty, our passion. Professional salon services with modern techniques and a relaxing atmosphere.
            </p>
            <div className="flex items-center space-x-3">
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/services" className="text-muted-foreground hover:text-foreground transition-colors">
                  Our Services
                </Link>
              </li>
              <li>
                <Link href="/team" className="text-muted-foreground hover:text-foreground transition-colors">
                  Meet the Team
                </Link>
              </li>
              <li>
                <Link href="/book" className="text-muted-foreground hover:text-foreground transition-colors">
                  Book Appointment
                </Link>
              </li>
              <li>
                <Link href="/reviews" className="text-muted-foreground hover:text-foreground transition-colors">
                  Client Reviews
                </Link>
              </li>
              <li>
                <Link href="/gift-cards" className="text-muted-foreground hover:text-foreground transition-colors">
                  Gift Cards
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h3 className="font-semibold mb-4">Customer Care</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/appointments" className="text-muted-foreground hover:text-foreground transition-colors">
                  My Appointments
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Cancellation Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  FAQs
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  123 Beauty Street<br />
                  San Francisco, CA 94102
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href="tel:555-012-3456" className="text-muted-foreground hover:text-foreground transition-colors">
                  (555) 012-3456
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href="mailto:hello@openfrontsalon.com" className="text-muted-foreground hover:text-foreground transition-colors">
                  hello@openfrontsalon.com
                </a>
              </li>
            </ul>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                <strong>Hours:</strong><br />
                Mon-Fri: 9am - 8pm<br />
                Sat-Sun: 10am - 6pm
              </p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t text-center text-sm text-muted-foreground">
          <p>
            &copy; {currentYear} Openfront Salon. All rights reserved. Built with{" "}
            <a
              href="https://github.com/openfront-ecommerce"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Openfront
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
