import { Metadata } from "next"
import Nav from "@/features/storefront/modules/layout/templates/nav"
import Footer from "@/features/storefront/modules/layout/templates/footer"

export async function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

export const MainNotFoundMetadata: Metadata = {
  title: "404",
  description: "Page not found",
}

export function MainNotFound() {
  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you tried to access does not exist.
      </p>
      <a href="/" className="text-primary hover:underline">
        Go to homepage
      </a>
    </div>
  )
}
