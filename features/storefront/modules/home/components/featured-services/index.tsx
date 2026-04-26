import Link from "next/link"

// TODO: Replace with actual data fetching from GraphQL API
const featuredServices = [
  {
    id: "1",
    name: "Haircut & Style",
    description: "Expert cuts and styling for all hair types",
    duration: "45 min",
    price: "From $45",
    category: "Hair",
  },
  {
    id: "2",
    name: "Color Treatment",
    description: "Full color, highlights, balayage, and more",
    duration: "2-3 hrs",
    price: "From $95",
    category: "Hair",
  },
  {
    id: "3",
    name: "Manicure & Pedicure",
    description: "Classic and gel nail services",
    duration: "60 min",
    price: "From $50",
    category: "Nails",
  },
  {
    id: "4",
    name: "Facial Treatment",
    description: "Customized skincare for your needs",
    duration: "60 min",
    price: "From $85",
    category: "Skin",
  },
]

export default function FeaturedServices() {
  return (
    <section className="mb-16">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Our Services</h2>
        <Link href="/services" className="text-primary hover:underline">
          View all services
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {featuredServices.map((service) => (
          <div
            key={service.id}
            className="border rounded-lg p-6 hover:shadow-lg transition-shadow bg-card"
          >
            <div className="text-xs font-medium text-primary mb-2">
              {service.category}
            </div>
            <h3 className="font-semibold text-lg mb-2">{service.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {service.description}
            </p>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{service.duration}</span>
              <span className="font-medium">{service.price}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
