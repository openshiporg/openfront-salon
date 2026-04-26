import { Suspense } from "react"
import { BookingPage } from "@/features/storefront/screens"

function BookingPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<BookingPageLoading />}>
      <BookingPage />
    </Suspense>
  )
}
