import { Metadata } from "next"
import Link from "next/link"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Our Stylists | Openfront Salon",
    description: "Meet our team of expert stylists and beauty professionals. Book an appointment with your preferred stylist.",
  }
}

// TODO: Replace with actual data fetching from GraphQL API
const stylists = [
  {
    id: "1",
    name: "Sarah Johnson",
    title: "Master Stylist",
    bio: "Sarah has over 12 years of experience specializing in color and balayage techniques. She trained in New York and has been recognized for her innovative color work.",
    specializations: ["Color", "Balayage", "Highlights", "Cuts"],
    tier: "master",
    yearsExperience: 12,
    availability: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  },
  {
    id: "2",
    name: "Michael Chen",
    title: "Senior Stylist",
    bio: "Michael is known for precision cuts and modern men's styling. With 8 years in the industry, he brings expertise in textured cuts and classic barbering techniques.",
    specializations: ["Men's Cuts", "Fades", "Textured Cuts", "Styling"],
    tier: "senior",
    yearsExperience: 8,
    availability: ["Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  {
    id: "3",
    name: "Emma Davis",
    title: "Nail Artist",
    bio: "Emma is a certified nail technician with a passion for nail art and creative designs. She specializes in gel extensions and intricate nail artwork.",
    specializations: ["Gel Nails", "Nail Art", "Manicure", "Pedicure"],
    tier: "senior",
    yearsExperience: 6,
    availability: ["Mon", "Wed", "Thu", "Fri", "Sat"],
  },
  {
    id: "4",
    name: "Jessica Williams",
    title: "Master Esthetician",
    bio: "Jessica is a licensed esthetician with over 10 years of experience in skincare. She specializes in anti-aging treatments and customized facial protocols.",
    specializations: ["Facials", "Chemical Peels", "Microdermabrasion", "Skincare"],
    tier: "master",
    yearsExperience: 10,
    availability: ["Mon", "Tue", "Wed", "Thu", "Sat"],
  },
  {
    id: "5",
    name: "David Rodriguez",
    title: "Massage Therapist",
    bio: "David is a licensed massage therapist trained in multiple modalities. He specializes in therapeutic and sports massage for pain relief and recovery.",
    specializations: ["Swedish Massage", "Deep Tissue", "Sports Massage", "Hot Stone"],
    tier: "senior",
    yearsExperience: 7,
    availability: ["Mon", "Tue", "Thu", "Fri", "Sat"],
  },
  {
    id: "6",
    name: "Ashley Thompson",
    title: "Junior Stylist",
    bio: "Ashley recently graduated from cosmetology school and brings fresh techniques and enthusiasm. She's building her clientele with great attention to detail.",
    specializations: ["Cuts", "Blowouts", "Basic Color", "Styling"],
    tier: "junior",
    yearsExperience: 2,
    availability: ["Wed", "Thu", "Fri", "Sat", "Sun"],
  },
]

function getTierBadgeColor(tier: string) {
  switch (tier) {
    case "master":
      return "bg-amber-100 text-amber-800"
    case "senior":
      return "bg-blue-100 text-blue-800"
    case "junior":
      return "bg-green-100 text-green-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export async function StylistsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Meet Our Team</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Our talented team of stylists and beauty professionals are here to help you look and feel your best. Book with your favorite stylist today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {stylists.map((stylist) => (
          <div
            key={stylist.id}
            className="border rounded-lg overflow-hidden bg-card hover:shadow-lg transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold text-muted-foreground">
                    {stylist.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{stylist.name}</h3>
                  <p className="text-sm text-primary">{stylist.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${getTierBadgeColor(
                    stylist.tier
                  )}`}
                >
                  {stylist.tier.charAt(0).toUpperCase() + stylist.tier.slice(1)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {stylist.yearsExperience} years experience
                </span>
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {stylist.bio}
              </p>

              <div className="mb-4">
                <p className="text-xs font-medium mb-2">Specializations</p>
                <div className="flex flex-wrap gap-1">
                  {stylist.specializations.map((spec) => (
                    <span
                      key={spec}
                      className="text-xs bg-secondary px-2 py-1 rounded"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs font-medium mb-2">Available</p>
                <div className="flex gap-1">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <span
                      key={day}
                      className={`text-xs px-2 py-1 rounded ${
                        stylist.availability.includes(day)
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </div>

              <Link
                href={`/book?stylist=${stylist.id}`}
                className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Book with {stylist.name.split(" ")[0]}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
