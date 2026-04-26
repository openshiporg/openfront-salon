import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Gallery - Openfront Salon",
  description: "Browse our portfolio of beautiful hair styles and transformations.",
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Gallery - Openfront Salon",
    description: "Browse our portfolio of beautiful hair styles and transformations.",
  }
}

export async function GalleryPage() {
  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Gallery</h1>
        <p className="text-lg text-muted-foreground">
          Browse our portfolio of beautiful transformations
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <p className="col-span-full text-center text-muted-foreground py-12">
          Gallery coming soon...
        </p>
      </div>
    </div>
  )
}
