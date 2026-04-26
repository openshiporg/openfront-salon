import { Metadata } from "next"
import Link from "next/link"
import { Gift, Heart, Sparkles } from "lucide-react"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Gift Cards | Openfront Salon",
    description: "Give the gift of beauty. Purchase digital gift cards for Openfront Salon services.",
  }
}

export async function GiftCardsPage() {
  const giftCardAmounts = [50, 100, 150, 200]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm mb-6">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Perfect Gift</span>
            </div>
            <h1 className="text-5xl font-bold mb-4">Gift Cards</h1>
            <p className="text-xl text-primary-foreground/90">
              Give the gift of beauty and relaxation. Perfect for any occasion.
            </p>
          </div>
        </div>
      </section>

      {/* Gift Card Options */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Choose an Amount</h2>
              <p className="text-muted-foreground">
                Select a gift card value or enter a custom amount
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-12">
              {giftCardAmounts.map((amount) => (
                <div
                  key={amount}
                  className="p-8 border-2 rounded-lg bg-card hover:border-primary/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Gift className="h-6 w-6" />
                    </div>
                    <div className="text-4xl font-bold">${amount}</div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Perfect for {amount === 50 ? "a quick service" : amount === 100 ? "a haircut and style" : amount === 150 ? "color treatment" : "a full spa day"}
                  </p>
                </div>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="bg-muted/30 border rounded-lg p-8 text-center">
              <h3 className="text-xl font-semibold mb-4">Custom Amount</h3>
              <p className="text-muted-foreground mb-6">
                Enter any amount between $25 and $500
              </p>
              <div className="max-w-sm mx-auto mb-6">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">$</span>
                  <input
                    type="number"
                    min="25"
                    max="500"
                    placeholder="100"
                    className="w-full pl-12 pr-4 py-3 text-2xl font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-center"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Gift cards never expire and can be used for any service
              </p>
              <button
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-8 py-3 font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Gift className="h-5 w-5" />
                Purchase Gift Card (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="p-6">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Digital Delivery</h3>
                <p className="text-sm text-muted-foreground">
                  Instant email delivery to you or your recipient
                </p>
              </div>
              <div className="p-6">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Never Expires</h3>
                <p className="text-sm text-muted-foreground">
                  Use anytime for any service
                </p>
              </div>
              <div className="p-6">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Gift className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Perfect Gift</h3>
                <p className="text-sm text-muted-foreground">
                  Great for birthdays, holidays, or any occasion
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
