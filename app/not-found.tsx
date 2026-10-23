import { generateNotFoundMetadata, MainLayout, MainNotFound } from "@/features/storefront/screens/MainLayout"

// Unknown top-level paths get the branded storefront 404, not the bare Next.js page.
export const generateMetadata = generateNotFoundMetadata

export default function NotFound() {
  return (
    <MainLayout>
      <MainNotFound />
    </MainLayout>
  )
}
