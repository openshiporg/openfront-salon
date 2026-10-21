export type SalonImageProjectionInput = {
  visibility?: unknown;
  image?: { url?: string | null } | null;
  imagePath?: string | null;
  altText?: string | null;
} | null | undefined;

export type PublicSalonImageProjection = {
  image: { url: string } | null;
  imagePath: string | null;
  altText: string | null;
};

/** Public elevated projections must not turn a private care attachment into a storefront asset. */
export function projectPublicSalonImage(image: SalonImageProjectionInput): PublicSalonImageProjection | null {
  if (!image || image.visibility !== "public") return null;
  return {
    image: typeof image.image?.url === "string" && image.image.url ? { url: image.image.url } : null,
    imagePath: typeof image.imagePath === "string" ? image.imagePath : null,
    altText: typeof image.altText === "string" ? image.altText : null,
  };
}
