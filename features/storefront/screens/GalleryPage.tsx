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
        <PageIntro title="Gallery" aside={<Link href="/book" className="sf-btn sf-btn-primary">Book</Link>} />

        {images.length > 0 ? (
          <div className="sf-gallery">
            {images.map(({ image, src }, index) => (
              <figure key={image.id} className="sf-carton" data-band={String((index % 6) + 1)}>
                <div className={`overflow-hidden bg-[var(--sf-alu)] ${index % 3 === 0 ? "aspect-[4/5]" : index % 3 === 1 ? "aspect-square" : "aspect-[4/3]"}`}>
                  <img src={src} alt={image.altText || image.metadata?.title || "Salon work"} loading={index < 3 ? undefined : "lazy"} className="h-full w-full object-cover" />
                </div>
                {image.metadata?.title || image.metadata?.caption ? (
                  <figcaption className="border-t-[0.5rem] border-[var(--band)] px-3 py-2.5">
                    {image.metadata?.title ? <p className="sf-carton-name !text-[length:var(--sf-text-lg)]">{image.metadata.title}</p> : null}
                    {image.metadata?.caption ? <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">{image.metadata.caption}</p> : null}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        ) : (
          <div className="sf-carton sf-carton-empty mx-auto max-w-md" data-band="ink">
            <h2 className="sf-display text-[length:var(--sf-text-2xl)]">No photos yet</h2>
            <div className="sf-track"><Link href="/services" className="sf-btn">Services</Link></div>
          </div>
        )}
      </div>
    </div>
  )
}
