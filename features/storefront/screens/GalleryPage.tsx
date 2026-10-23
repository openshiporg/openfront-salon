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
  const images = (await getGalleryImages()).flatMap((image) => {
    const src = getStorefrontImageSrc(image)
    return src ? [{ image, src }] : []
  })

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro
          title={<>The <em>work</em></>}
          size="large"
          aside={<div className="sf-track"><Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link></div>}
        />

        {images.length > 0 ? (
          <div className="sf-masonry">
            {images.map(({ image, src }, index) => (
              <figure key={image.id}>
                <div className={`sf-media ${index % 3 === 0 ? "aspect-[4/5]" : index % 3 === 1 ? "aspect-square" : "aspect-[4/3]"}`}>
                  <img src={src} alt={image.altText || image.metadata?.title || "Salon work"} loading={index < 3 ? undefined : "lazy"} />
                </div>
                {image.metadata?.title || image.metadata?.caption ? (
                  <figcaption className="mt-2.5 px-1">
                    {image.metadata?.title ? <p className="font-semibold text-[length:var(--sf-text-sm)]">{image.metadata.title}</p> : null}
                    {image.metadata?.caption ? <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">{image.metadata.caption}</p> : null}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        ) : (
          <div className="sf-card-quiet flex flex-col items-center px-6 py-[var(--sf-space-2xl)] text-center">
            <h2 className="sf-display mb-6 text-[length:var(--sf-text-2xl)]">No photos yet</h2>
            <div className="sf-track"><Link href="/services" className="sf-btn">Service menu</Link></div>
          </div>
        )}
      </div>
    </div>
  )
}
