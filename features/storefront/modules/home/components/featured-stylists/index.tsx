import Link from "next/link"

// TODO: Replace with actual data fetching from GraphQL API
const featuredStylists = [
  {
    id: "1",
    name: "Sarah Johnson",
    title: "Master Stylist",
    specializations: ["Color", "Balayage", "Cuts"],
    experience: "12 years",
  },
  {
    id: "2",
    name: "Michael Chen",
    title: "Senior Stylist",
    specializations: ["Men's Cuts", "Fades", "Styling"],
    experience: "8 years",
  },
  {
    id: "3",
    name: "Emma Davis",
    title: "Nail Artist",
    specializations: ["Gel", "Nail Art", "Pedicure"],
    experience: "6 years",
  },
  {
    id: "4",
    name: "Jessica Williams",
    title: "Esthetician",
    specializations: ["Facials", "Chemical Peels", "Skincare"],
    experience: "10 years",
  },
]

export default function FeaturedStylists() {
  return (
    <section>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Meet Our Stylists</h2>
        <Link href="/stylists" className="text-primary hover:underline">
          View all stylists
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {featuredStylists.map((stylist) => (
          <div
            key={stylist.id}
            className="border rounded-lg p-6 text-center hover:shadow-lg transition-shadow bg-card"
          >
            <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl font-bold text-muted-foreground">
                {stylist.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <h3 className="font-semibold text-lg">{stylist.name}</h3>
            <p className="text-sm text-primary mb-2">{stylist.title}</p>
            <p className="text-xs text-muted-foreground mb-3">
              {stylist.experience} experience
            </p>
            <div className="flex flex-wrap gap-1 justify-center">
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
        ))}
      </div>
    </section>
  )
}
