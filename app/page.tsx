import { products } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Leaf, Package, Sparkles, Star } from "lucide-react"
import Link from "next/link"
import { ChatWidget } from "@/components/chat-widget"

export default function StorefrontPage() {
  const featuredProducts = products.filter(p => p.stock_status !== "out_of_stock").slice(0, 4)
  
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              S
            </div>
            <span className="text-lg font-semibold">SmartSouk</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#products" className="text-sm text-muted-foreground hover:text-foreground">
              Products
            </Link>
            <Link href="#about" className="text-sm text-muted-foreground hover:text-foreground">
              About
            </Link>
            <Link href="#contact" className="text-sm text-muted-foreground hover:text-foreground">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-24 md:py-32">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              Authentic Tunisian Craftsmanship
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-balance">
              Discover the Soul of Tunisia
            </h1>
            <p className="mt-6 text-lg text-muted-foreground text-balance">
              Handcrafted ceramics, woven rugs, and organic oils - each piece tells a story of 
              tradition, quality, and the skilled hands of Tunisian artisans.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="#products">
                  Shop Collection <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/dashboard">
                  For Business Owners
                </Link>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </section>

      {/* Features */}
      <section className="border-y bg-muted/30 py-12">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Leaf className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">100% Natural</h3>
                <p className="text-sm text-muted-foreground">Organic oils and natural materials</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Worldwide Shipping</h3>
                <p className="text-sm text-muted-foreground">Delivery to your doorstep</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Handcrafted</h3>
                <p className="text-sm text-muted-foreground">By skilled local artisans</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section id="products" className="py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Featured Products</h2>
            <p className="mt-2 text-muted-foreground">
              Our most popular handcrafted items from Tunisia
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <Card key={product.id} className="group overflow-hidden">
                <div className="aspect-square bg-muted relative">
                  <div className="absolute inset-0 flex items-center justify-center text-4xl text-muted-foreground/30">
                    {product.category === "ceramics" && "🏺"}
                    {product.category === "rugs" && "🧶"}
                    {product.category === "oils" && "🫒"}
                  </div>
                  {product.stock_status === "low_stock" && (
                    <Badge variant="destructive" className="absolute top-2 right-2">
                      Low Stock
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center gap-1 text-amber-500 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-current" />
                    ))}
                    <span className="ml-1 text-xs text-muted-foreground">(12)</span>
                  </div>
                  <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {product.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold">{product.price_tnd} TND</span>
                    <Button size="sm">Add to Cart</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Button variant="outline" size="lg">
              View All Products <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="border-t bg-muted/30 py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Our Story</h2>
            <p className="mt-4 text-muted-foreground">
              SmartSouk was founded with a simple mission: to bring the authentic craftsmanship of 
              Tunisia to the world. We work directly with artisan communities across Tunisia - from 
              the pottery villages of Sejnane to the olive groves of Sfax - ensuring fair prices 
              for craftspeople and authentic products for our customers.
            </p>
            <p className="mt-4 text-muted-foreground">
              Every piece in our collection is handmade using traditional techniques passed down 
              through generations. When you buy from SmartSouk, you&apos;re not just getting a product 
              - you&apos;re supporting a living heritage.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                S
              </div>
              <span className="text-lg font-semibold">SmartSouk</span>
            </div>
            <p className="text-sm text-muted-foreground">
              2024 SmartSouk. Made with love in Tunisia.
            </p>
          </div>
        </div>
      </footer>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  )
}
