import { Metadata } from "next"
import Link from "next/link"
import { Calendar, Clock, User, AlertCircle } from "lucide-react"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "My Appointments | Openfront Salon",
    description: "View and manage your salon appointments",
  }
}

export async function AppointmentsPage() {
  // TODO: Implement authentication and appointment fetching
  // For now, showing a placeholder

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 to-primary/5 py-16 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-4">My Appointments</h1>
            <p className="text-xl text-muted-foreground">
              View your upcoming and past salon appointments
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Login/Auth Prompt */}
            <div className="text-center py-20 border rounded-lg bg-muted/30">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">Sign In Required</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Please sign in to view your appointments. Don't have an account yet? Book an appointment to create one automatically.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition-all"
                >
                  Book an Appointment
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 font-medium hover:bg-muted transition-all"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
