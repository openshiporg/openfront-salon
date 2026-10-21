import { Metadata } from "next"
import Link from "next/link"
import { getGalleryImages } from "../lib/data/gallery"
import { getStorefrontImageSrc } from "../lib/images"
import { PageIntro } from "../components/ui/PageIntro"
import { getStorefrontBrand, storefrontTitle } from "../lib/data/brand"

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getStorefrontBrand()
  return {
    title: await storefrontTitle("Gallery"),
    description: brand.name ? `Color, cutting, and skin work from ${brand.name}.` : "Color, cutting, and skin work from the salon team.",
  }
}

export async function GalleryPage() {
  const images = await getGalleryImages()

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro
          title="The work"
          description="A working portfolio from the color bar, cutting floor, and treatment room."
          size="large"
        />

        {images.length > 0 ? (
          <div className="grid gap-[var(--sf-space-md)] md:grid-cols-2">
            {images.map((image, index) => {
              const src = getStorefrontImageSrc(image)
              if (!src) return null

              return (
                <figure
                  key={image.id}
                  className={`overflow-hidden border border-[var(--sf-rule)] bg-[var(--sf-paper)] ${
                    index === 0 ? "md:col-span-2" : ""
                  }`}
                >
                  <div className={index === 0 ? "aspect-[16/8] overflow-hidden" : "aspect-[4/3] overflow-hidden"}>
                    <img
                      src={src}
                      alt={image.altText || image.metadata?.title || "Salon work"}
                      className="h-full w-full object-cover transition-transform duration-[var(--sf-dur-medium)] hover:scale-[1.01]"
                    />
                  </div>
                  <figcaption className="border-t border-[var(--sf-rule)] p-[var(--sf-space-md)]">
                    <p className="sf-display text-[var(--sf-text-xl)]">
                      {image.metadata?.title || image.altText || "Salon work"}
                    </p>
                    {image.metadata?.caption ? (
                      <p className="mt-1 text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">
                        {image.metadata.caption}
                      </p>
                    ) : null}
                  </figcaption>
                </figure>
              )
            })}
          </div>
        ) : (
          <div className="border border-dashed border-[var(--sf-rule)] py-[var(--sf-space-2xl)] text-center">
            <p className="mb-6 text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">
              No photos yet.
            </p>
            <Link href="/services" className="sf-btn sf-btn-secondary">
              Browse the service menu
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
