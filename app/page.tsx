"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  BarChart3,
  Check,
  Globe2,
  Headset,
  Loader2,
  Mail,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import { CartDropdown } from "@/components/cart-dropdown"
import { ChatWidget } from "@/components/chat-widget"
import { useCart } from "@/hooks/use-cart"
import { useSessionTracking } from "@/hooks/use-session-tracking"
import { useSession } from "@/lib/auth-client"
import type { StoreProduct, StoreSettings } from "@/lib/store-types"
import type { UserDashboardInsightsResponse } from "@/lib/tracking-types"

interface StoreBootstrapResponse {
  settings: StoreSettings
  products: StoreProduct[]
  persisted: boolean
}

interface CapabilityItem {
  id: string
  title: string
  description: string
  icon: LucideIcon
}

interface PricingTier {
  id: string
  name: string
  price: string
  description: string
  ctaLabel: string
  highlighted?: boolean
  features: string[]
}

interface FAQItem {
  id: string
  question: string
  answer: string
}

const fallbackSettings: StoreSettings = {
  store_name: "Aurea",
  store_description:
    "A curated fragrance house where artisanal sourcing meets intelligent commerce automation.",
  contact_email: "contact@aurea.house",
  hero_image_url: "",
  site_icon_url: "",
  feature_one_title: "Ingredient Integrity",
  feature_one_description: "Transparent sourcing and formula traceability across every SKU.",
  feature_two_title: "Global Distribution",
  feature_two_description: "Fast fulfillment workflows for local and international orders.",
  feature_three_title: "Creative Intelligence",
  feature_three_description: "AI-driven campaign planning and audience targeting for each launch.",
  updated_at: Date.now(),
}

const capabilityItems: CapabilityItem[] = [
  {
    id: "01",
    title: "Real-Time Collaboration",
    description:
      "Coordinate launch calendars, product updates, and team approvals in a single operational surface.",
    icon: Users,
  },
  {
    id: "02",
    title: "Smart Automation",
    description:
      "Automate repetitive merchandising and campaign tasks so your team can focus on creative direction.",
    icon: Workflow,
  },
  {
    id: "03",
    title: "Advanced Analytics",
    description:
      "Understand customer behavior, campaign response, and product performance with clear decision signals.",
    icon: BarChart3,
  },
  {
    id: "04",
    title: "Seamless Integrations",
    description:
      "Connect storefront, CRM, messaging, and inventory tools without breaking your existing workflow.",
    icon: Sparkles,
  },
  {
    id: "05",
    title: "Enterprise Security",
    description:
      "Protect customer and transaction data with strict controls, encrypted transport, and hardened access.",
    icon: ShieldCheck,
  },
  {
    id: "06",
    title: "24/7 Support",
    description:
      "Get technical and operational guidance whenever your team needs support during critical campaigns.",
    icon: Headset,
  },
  {
    id: "07",
    title: "Global Infrastructure",
    description:
      "Serve audiences worldwide with low-latency delivery paths and resilient cloud infrastructure.",
    icon: Globe2,
  },
]

const pricingTiers: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: "49 TND / mo",
    description: "For artisan stores launching their first smart storefront and campaign workflow.",
    ctaLabel: "Start Free Trial",
    features: [
      "Up to 50 products",
      "Storefront AI chat assistant",
      "Basic sales and traffic analytics",
      "Cart and order tracking",
      "5 AI marketing generations / day",
      "Email support",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: "129 TND / mo",
    description: "For growing brands that need stronger automation, segmentation, and conversion tools.",
    ctaLabel: "Start Free Trial",
    highlighted: true,
    features: [
      "Up to 500 products",
      "Advanced recommendations and lead scoring",
      "Full funnel analytics dashboard",
      "Audience segments and email campaigns",
      "20 AI image/caption generations / day",
      "Webhook and API access",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "For large commerce operations requiring governance, custom integrations, and dedicated support.",
    ctaLabel: "Contact Sales",
    features: [
      "Unlimited products and multi-store support",
      "Custom AI workflows and automation",
      "Private integrations (ERP/CRM/warehouse)",
      "Advanced security and compliance controls",
      "SSO, roles, and audit-ready access logs",
      "Dedicated account manager",
      "24/7 support with custom SLA",
    ],
  },
]

const commonQuestions: FAQItem[] = [
  {
    id: "01",
    question: "How does the free trial work?",
    answer:
      "Start your 14-day free trial without a credit card. You get full access to your selected plan and can cancel at any point during the trial.",
  },
  {
    id: "02",
    question: "Can I change plans later?",
    answer:
      "Yes. You can upgrade or downgrade anytime. Adjustments are applied immediately, with prorated billing where relevant.",
  },
  {
    id: "03",
    question: "What payment methods do you accept?",
    answer:
      "We support major credit cards, PayPal, and wire transfer for annual enterprise agreements.",
  },
  {
    id: "04",
    question: "Is my data secure?",
    answer:
      "Yes. We use encrypted transport and storage, strict access control, and compliance-focused operational practices.",
  },
  {
    id: "05",
    question: "Do you offer discounts for annual plans?",
    answer:
      "Yes. Annual billing includes a savings multiplier compared to monthly terms and simplifies procurement cycles.",
  },
  {
    id: "06",
    question: "What kind of support do you provide?",
    answer:
      "All tiers include email support, professional includes priority handling, and enterprise includes dedicated 24/7 support channels.",
  },
]

function getCategoryMonogram(category: StoreProduct["category"]): string {
  if (category === "ceramics") {
    return "CR"
  }

  if (category === "rugs") {
    return "RG"
  }

  return "OL"
}

function getStockBadgeLabel(status: StoreProduct["stock_status"]): string {
  if (status === "low_stock") {
    return "Low Stock"
  }

  if (status === "out_of_stock") {
    return "Out Of Stock"
  }

  return "In Stock"
}

function getStockBadgeClassName(status: StoreProduct["stock_status"]): string {
  if (status === "out_of_stock") {
    return "bg-accent text-accent-foreground"
  }

  if (status === "low_stock") {
    return "bg-muted text-foreground"
  }

  return "bg-background text-foreground"
}

function toBackgroundImage(url: string): string {
  return `url("${url.replace(/"/g, '\\\"')}")`
}

export default function StorefrontPage() {
  const { sessionId, currentPath, trackProductEvent, trackChatOpen } = useSessionTracking()
  const { data: session } = useSession()
  const { items: cartItems, addItem } = useCart()
  const [focusedProductId, setFocusedProductId] = useState<string | null>(null)
  const [settings, setSettings] = useState<StoreSettings>(fallbackSettings)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loadingStore, setLoadingStore] = useState(true)
  const [statusMessage, setStatusMessage] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [userInsights, setUserInsights] = useState<UserDashboardInsightsResponse | null>(null)
  const viewedProductsRef = useRef<Set<string>>(new Set())

  const inStockProducts = useMemo(
    () => products.filter((product) => product.stock_status !== "out_of_stock"),
    [products]
  )

  const featuredProducts = useMemo(() => inStockProducts.slice(0, 8), [inStockProducts])

  const storefrontFeatures = useMemo(
    () => [
      {
        icon: Sparkles,
        title: settings.feature_one_title?.trim() || "Ingredient Integrity",
        description:
          settings.feature_one_description?.trim() ||
          "Transparent sourcing and formula traceability across every SKU.",
      },
      {
        icon: Globe2,
        title: settings.feature_two_title?.trim() || "Global Distribution",
        description:
          settings.feature_two_description?.trim() ||
          "Fast fulfillment workflows for local and international orders.",
      },
      {
        icon: Workflow,
        title: settings.feature_three_title?.trim() || "Creative Intelligence",
        description:
          settings.feature_three_description?.trim() ||
          "AI-driven campaign planning and audience targeting for each launch.",
      },
    ],
    [
      settings.feature_one_description,
      settings.feature_one_title,
      settings.feature_three_description,
      settings.feature_three_title,
      settings.feature_two_description,
      settings.feature_two_title,
    ]
  )

  const cartQuantityByProductId = useMemo(() => {
    const byProduct = new Map<string, number>()
    for (const item of cartItems) {
      byProduct.set(item.product_id, (byProduct.get(item.product_id) ?? 0) + Math.max(1, item.quantity))
    }
    return byProduct
  }, [cartItems])

  const loadStoreData = async () => {
    setLoadingStore(true)
    try {
      const response = await fetch("/api/store/bootstrap", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })

      if (!response.ok) {
        setStatusMessage("Failed to load store data")
        return
      }

      const payload = (await response.json()) as StoreBootstrapResponse
      setSettings(payload.settings)
      setProducts(Array.isArray(payload.products) ? payload.products : [])
    } catch {
      setStatusMessage("Failed to load store data")
    } finally {
      setLoadingStore(false)
    }
  }

  useEffect(() => {
    void loadStoreData()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setIsAdmin(false)
      return
    }

    let active = true
    void fetch("/api/auth/is-admin", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json() as Promise<{ isAdmin?: boolean }>)
      .then((payload) => {
        if (!active) {
          return
        }
        setIsAdmin(Boolean(payload.isAdmin))
      })
      .catch(() => {
        if (active) {
          setIsAdmin(false)
        }
      })

    return () => {
      active = false
    }
  }, [session?.user])

  useEffect(() => {
    if (!session?.user || isAdmin) {
      setUserInsights(null)
      return
    }

    let active = true
    void fetch("/api/dashboard/insights", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          return null
        }

        return (await response.json()) as UserDashboardInsightsResponse
      })
      .then((payload) => {
        if (active) {
          setUserInsights(payload)
        }
      })
      .catch(() => {
        if (active) {
          setUserInsights(null)
        }
      })

    return () => {
      active = false
    }
  }, [isAdmin, session?.user])

  const recommendedProducts = useMemo(() => {
    if (!session?.user || isAdmin || inStockProducts.length === 0) {
      return [] as StoreProduct[]
    }

    const selected: StoreProduct[] = []
    const usedIds = new Set<string>()
    const primaryRecommendation = userInsights?.recommendation?.product_id
    const primaryProduct = primaryRecommendation
      ? inStockProducts.find((product) => product.id === primaryRecommendation)
      : undefined

    if (primaryProduct) {
      selected.push(primaryProduct)
      usedIds.add(primaryProduct.id)

      for (const product of inStockProducts) {
        if (selected.length >= 3) {
          break
        }

        if (usedIds.has(product.id)) {
          continue
        }

        if (product.category === primaryProduct.category) {
          selected.push(product)
          usedIds.add(product.id)
        }
      }
    }

    for (const product of inStockProducts) {
      if (selected.length >= 3) {
        break
      }

      if (usedIds.has(product.id)) {
        continue
      }

      selected.push(product)
      usedIds.add(product.id)
    }

    return selected
  }, [inStockProducts, isAdmin, session?.user, userInsights?.recommendation?.product_id])

  const lowestPrice = useMemo(() => {
    if (inStockProducts.length === 0) {
      return null
    }

    return Math.min(...inStockProducts.map((product) => product.price_tnd))
  }, [inStockProducts])

  const handleProductHover = (productId: string) => {
    setFocusedProductId(productId)
    if (!viewedProductsRef.current.has(productId)) {
      viewedProductsRef.current.add(productId)
      trackProductEvent(productId, "product_view")
    }
  }

  const handleProductClick = (productId: string) => {
    setFocusedProductId(productId)
    trackProductEvent(productId, "click")
  }

  const handleAddToCart = (product: StoreProduct) => {
    if (product.stock_status === "out_of_stock") {
      return
    }

    setFocusedProductId(product.id)
    addItem(product.id, 1)
    trackProductEvent(product.id, "add_to_cart")
    setStatusMessage(`${product.name} added to cart.`)
  }

  const heroImageUrl = settings.hero_image_url?.trim() || ""
  const storeInitial = settings.store_name.charAt(0).toUpperCase() || "A"

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b-4 border-black bg-background/95 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
            <Link href="/" className="flex min-w-0 items-center gap-3 lg:justify-self-start">
            {settings.site_icon_url ? (
              <img
                src={settings.site_icon_url}
                alt="Store icon"
                className="h-10 w-10 border-2 border-black object-contain p-1"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-black text-lg font-black text-white">
                {storeInitial}
              </div>
            )}
              <div>
                <p className="swiss-section-label leading-none">{settings.store_name} Inc.</p>
                <p className="text-base font-black uppercase tracking-tight">{settings.store_name}</p>
              </div>
            </Link>

            <nav className="hidden items-center gap-7 lg:flex lg:justify-self-center">
              <Link href="#products" className="swiss-link-stack">
                <span>Collection</span>
                <span>Collection</span>
              </Link>
              <Link href="#capabilities" className="swiss-link-stack">
                <span>Capabilities</span>
                <span>Capabilities</span>
              </Link>
              <Link href="#investment" className="swiss-link-stack">
                <span>Investment</span>
                <span>Investment</span>
              </Link>
              <Link href="#faq" className="swiss-link-stack">
                <span>Questions</span>
                <span>Questions</span>
              </Link>
              <Link href="#contact" className="swiss-link-stack">
                <span>Connect</span>
                <span>Connect</span>
              </Link>
            </nav>

            <div className="ml-auto flex items-center gap-2 sm:gap-3 lg:ml-0 lg:justify-self-end">
              {isAdmin ? (
                <span className="hidden text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:inline">
                  Admin
                </span>
              ) : (
                <CartDropdown sessionId={sessionId} />
              )}
              <Link
                href="/dashboard"
                className="swiss-button swiss-button-secondary min-h-11 px-3 text-[0.58rem] tracking-[0.14em] sm:px-4 sm:text-[0.62rem]"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b-4 border-black">
          <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-12">
            <div className="swiss-grid-pattern border-b-4 border-black px-4 py-12 sm:px-6 md:py-16 lg:col-span-8 lg:border-b-0 lg:border-r-4 lg:px-10 xl:py-24">
              <p className="swiss-section-label">01. System</p>
              <h1 className="swiss-display mt-6 text-5xl sm:text-6xl md:text-7xl xl:text-8xl">
                {settings.store_name}
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-relaxed md:text-lg">{settings.store_description}</p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link href="#products" className="swiss-button swiss-button-primary w-full sm:w-auto">
                  Shop Collection
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="#investment" className="swiss-button swiss-button-secondary w-full sm:w-auto">
                  View Investment
                </Link>
              </div>

              {statusMessage ? (
                <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                  {statusMessage}
                </p>
              ) : null}

              <div className="mt-10 grid grid-cols-2 border-4 border-black bg-background md:grid-cols-4">
                <div className="border-b-2 border-r-2 border-black p-4 md:border-b-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Products</p>
                  <p className="mt-2 text-3xl font-black">{inStockProducts.length}</p>
                </div>
                <div className="border-b-2 border-black p-4 md:border-b-0 md:border-r-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Min Price</p>
                  <p className="mt-2 text-3xl font-black">{lowestPrice !== null ? `${lowestPrice} TND` : "-"}</p>
                </div>
                <div className="border-r-2 border-black p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Segments</p>
                  <p className="mt-2 text-3xl font-black">{capabilityItems.length}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Support</p>
                  <p className="mt-2 text-3xl font-black">24/7</p>
                </div>
              </div>
            </div>

            <div className="bg-muted lg:col-span-4">
              <div className="h-full border-black p-6 sm:p-8 lg:p-10">
                <p className="swiss-section-label">Structured Composition</p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div
                    className="swiss-grid-pattern relative col-span-2 border-4 border-black"
                    style={
                      heroImageUrl
                        ? {
                            backgroundImage: `${toBackgroundImage(heroImageUrl)}, linear-gradient(rgb(0 0 0 / 30%), rgb(0 0 0 / 30%))`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  >
                    <div className="flex min-h-[240px] items-end justify-between p-5">
                      <p
                        className={`text-xs font-bold uppercase tracking-[0.2em] ${
                          heroImageUrl ? "text-white" : "text-foreground"
                        }`}
                      >
                        Editorial Frame
                      </p>
                      <p
                        className={`text-xs font-bold uppercase tracking-[0.2em] ${
                          heroImageUrl ? "text-white" : "text-muted-foreground"
                        }`}
                      >
                        GRID / 12
                      </p>
                    </div>
                  </div>
                  <div className="swiss-dots flex min-h-[120px] items-center justify-center border-4 border-black bg-background">
                    <div className="h-14 w-14 border-4 border-black bg-accent" />
                  </div>
                  <div className="swiss-diagonal flex min-h-[120px] items-center justify-center border-4 border-black bg-background">
                    <div className="h-16 w-4 bg-black" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="border-b-4 border-black bg-muted">
          <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-12">
            <aside className="border-b-4 border-black px-4 py-8 sm:px-6 lg:col-span-3 lg:border-b-0 lg:border-r-4 lg:px-8 lg:py-10">
              <p className="swiss-section-label">02. Method</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Craft Logic</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Clear hierarchy, strict systems, and measurable actions from product curation to campaign execution.
              </p>
            </aside>

            <div className="lg:col-span-9">
              <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
                {storefrontFeatures.map((feature) => (
                  <article
                    key={feature.title}
                    className="group border-2 border-black bg-background p-6 transition-all duration-200 ease-out hover:-translate-y-px hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex items-center justify-between">
                      <feature.icon className="h-6 w-6" />
                      <Plus className="h-5 w-5 transition-transform duration-200 ease-out group-hover:rotate-90" />
                    </div>
                    <h3 className="mt-6 text-xl font-black uppercase tracking-tight">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground group-hover:text-white/90">
                      {feature.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {session?.user && !isAdmin && recommendedProducts.length > 0 && (
          <section id="recommended" className="border-b-4 border-black bg-background">
            <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-12">
              <aside className="border-b-4 border-black px-4 py-8 sm:px-6 lg:col-span-3 lg:border-b-0 lg:border-r-4 lg:px-8 lg:py-10">
                <p className="swiss-section-label">03. Profile</p>
                <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Recommended</h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {userInsights?.recommendation?.reason ??
                    "Selected from your browsing and engagement patterns."}
                </p>
              </aside>

              <div className="lg:col-span-9">
                <div className="grid gap-4 p-4 md:grid-cols-3 md:p-6">
                  {recommendedProducts.map((product) => (
                    <article
                      key={`recommended-${product.id}`}
                      onMouseEnter={() => handleProductHover(product.id)}
                      className="group border-2 border-black bg-background transition-all duration-200 ease-out hover:-translate-y-px hover:bg-muted"
                    >
                      <div className="relative aspect-[4/3] border-b-2 border-black bg-muted">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-cover transition duration-200 ease-out group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="swiss-grid-pattern flex h-full w-full flex-col items-center justify-center gap-3">
                            <span className="border-2 border-black px-3 py-1 text-xl font-black">
                              {getCategoryMonogram(product.category)}
                            </span>
                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                              {product.category}
                            </span>
                          </div>
                        )}
                        <span className="absolute right-2 top-2 border-2 border-black bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                          For You
                        </span>
                      </div>

                      <div className="space-y-4 p-4">
                        <Link href={`/articles/${product.id}`} onClick={() => handleProductClick(product.id)}>
                          <h3 className="text-lg font-black uppercase tracking-tight">{product.name}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {product.description}
                          </p>
                        </Link>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xl font-black uppercase tracking-tight">
                            {product.price_tnd} TND
                          </span>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/articles/${product.id}`}
                              onClick={() => handleProductClick(product.id)}
                              className="swiss-button swiss-button-secondary min-h-10 px-3 text-[0.62rem] tracking-[0.14em]"
                            >
                              Article
                            </Link>
                            <button
                              type="button"
                              disabled={product.stock_status === "out_of_stock"}
                              onClick={() => handleAddToCart(product)}
                              className="swiss-button swiss-button-primary min-h-10 px-3 text-[0.62rem] tracking-[0.14em] disabled:cursor-not-allowed disabled:border-muted-foreground disabled:bg-muted disabled:text-muted-foreground"
                            >
                              {cartQuantityByProductId.has(product.id)
                                ? `In Cart (${cartQuantityByProductId.get(product.id)})`
                                : "Add To Cart"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="products" className="border-b-4 border-black bg-background">
          <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-12">
            <aside className="border-b-4 border-black px-4 py-8 sm:px-6 lg:col-span-3 lg:border-b-0 lg:border-r-4 lg:px-8 lg:py-10">
              <p className="swiss-section-label">04. Collection</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Featured Products</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                A selection of signature lines with article pages, stock status, and direct purchase actions.
              </p>
            </aside>

            <div className="lg:col-span-9">
              {loadingStore ? (
                <div className="flex min-h-[360px] items-center justify-center p-8">
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">
                  {featuredProducts.map((product) => (
                    <article
                      key={product.id}
                      onMouseEnter={() => handleProductHover(product.id)}
                      className="group border-2 border-black bg-background transition-all duration-200 ease-out hover:-translate-y-px hover:bg-muted"
                    >
                      <div className="relative aspect-[4/5] border-b-2 border-black bg-muted">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-cover transition duration-200 ease-out group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="swiss-dots flex h-full w-full flex-col items-center justify-center gap-3">
                            <span className="border-2 border-black px-3 py-1 text-xl font-black">
                              {getCategoryMonogram(product.category)}
                            </span>
                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                              {product.category}
                            </span>
                          </div>
                        )}
                        <span
                          className={`absolute right-2 top-2 border-2 border-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${getStockBadgeClassName(product.stock_status)}`}
                        >
                          {getStockBadgeLabel(product.stock_status)}
                        </span>
                      </div>

                      <div className="space-y-4 p-4">
                        <Link href={`/articles/${product.id}`} onClick={() => handleProductClick(product.id)}>
                          <h3 className="text-lg font-black uppercase tracking-tight">{product.name}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {product.description}
                          </p>
                        </Link>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xl font-black uppercase tracking-tight">
                            {product.price_tnd} TND
                          </span>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/articles/${product.id}`}
                              onClick={() => handleProductClick(product.id)}
                              className="swiss-button swiss-button-secondary min-h-10 px-3 text-[0.62rem] tracking-[0.14em]"
                            >
                              Article
                            </Link>
                            {isAdmin ? (
                              <Link
                                href="/dashboard/products"
                                className="swiss-button swiss-button-primary min-h-10 px-3 text-[0.62rem] tracking-[0.14em]"
                              >
                                Manage
                              </Link>
                            ) : (
                              <button
                                type="button"
                                disabled={product.stock_status === "out_of_stock"}
                                onClick={() => handleAddToCart(product)}
                                className="swiss-button swiss-button-primary min-h-10 px-3 text-[0.62rem] tracking-[0.14em] disabled:cursor-not-allowed disabled:border-muted-foreground disabled:bg-muted disabled:text-muted-foreground"
                              >
                                {cartQuantityByProductId.has(product.id)
                                  ? `In Cart (${cartQuantityByProductId.get(product.id)})`
                                  : "Add To Cart"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-b-4 border-black bg-muted">
          <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-12">
            <aside className="border-b-4 border-black px-4 py-8 sm:px-6 lg:col-span-3 lg:border-b-0 lg:border-r-4 lg:px-8 lg:py-10">
              <p className="swiss-section-label">05. Capabilities</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Capabilities And Functions</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                A modular system built for teams that need speed, structure, and measurable growth.
              </p>
            </aside>

            <div className="lg:col-span-9">
              <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
                {capabilityItems.map((item) => (
                  <article
                    key={item.id}
                    className="group border-2 border-black bg-background p-6 transition-all duration-200 ease-out hover:-translate-y-px hover:bg-black hover:text-white"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold uppercase tracking-[0.24em] text-accent group-hover:text-accent">
                        {item.id}
                      </span>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-2xl font-black uppercase tracking-tight">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground group-hover:text-white/85">
                      {item.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="investment" className="border-b-4 border-black bg-background">
          <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-12">
            <aside className="border-b-4 border-black px-4 py-8 sm:px-6 lg:col-span-3 lg:border-b-0 lg:border-r-4 lg:px-8 lg:py-10">
              <p className="swiss-section-label">06. Investment</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Pricing Architecture</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Clear tiers from startup operations to enterprise-grade governance and support.
              </p>
            </aside>

            <div className="lg:col-span-9">
              <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-3">
                {pricingTiers.map((tier) => (
                  <article
                    key={tier.id}
                    className={`border-2 border-black p-6 ${
                      tier.highlighted ? "bg-black text-white" : "bg-background text-foreground"
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-[0.22em] ${
                        tier.highlighted ? "text-white/80" : "text-muted-foreground"
                      }`}
                    >
                      {tier.name}
                    </p>
                    <p className="mt-4 text-5xl font-black uppercase tracking-tight">{tier.price}</p>
                    <p
                      className={`mt-4 min-h-16 text-sm leading-relaxed ${
                        tier.highlighted ? "text-white/85" : "text-muted-foreground"
                      }`}
                    >
                      {tier.description}
                    </p>

                    <ul className="mt-6 space-y-2">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className={`mt-8 swiss-button w-full ${
                        tier.highlighted ? "swiss-button-primary" : "swiss-button-secondary"
                      }`}
                    >
                      {tier.ctaLabel}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="border-b-4 border-black bg-muted">
          <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-12">
            <aside className="border-b-4 border-black px-4 py-8 sm:px-6 lg:col-span-3 lg:border-b-0 lg:border-r-4 lg:px-8 lg:py-10">
              <p className="swiss-section-label">07. Common Questions</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Everything You Need To Know</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Platform, billing, and support details for teams evaluating deployment and scale.
              </p>
            </aside>

            <div className="lg:col-span-9">
              <div className="space-y-4 p-4 sm:p-6">
                {commonQuestions.map((item) => (
                  <article
                    key={item.id}
                    className="group border-2 border-black bg-background p-5 transition-all duration-200 ease-out hover:-translate-y-px hover:bg-accent hover:text-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent group-hover:text-white/90">
                          {item.id}
                        </p>
                        <h3 className="mt-2 text-xl font-black uppercase tracking-tight">{item.question}</h3>
                      </div>
                      <Plus className="mt-1 h-5 w-5 shrink-0 transition-transform duration-200 ease-out group-hover:rotate-90" />
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground group-hover:text-white/90">
                      {item.answer}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="journal" className="border-b-4 border-black bg-background">
          <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-12">
            <aside className="border-b-4 border-black px-4 py-8 sm:px-6 lg:col-span-3 lg:border-b-0 lg:border-r-4 lg:px-8 lg:py-10">
              <p className="swiss-section-label">08. Journal</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Field Notes</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Insights on scent development, customer behavior, and digital merchandising practice.
              </p>
            </aside>

            <div className="lg:col-span-9">
              <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
                <article className="swiss-grid-pattern border-2 border-black bg-muted p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Research</p>
                  <h3 className="mt-4 text-2xl font-black uppercase tracking-tight">Sensory Mapping</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Translating customer feedback into a structured fragrance taxonomy for product roadmaps.
                  </p>
                </article>
                <article className="swiss-dots border-2 border-black bg-muted p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Operations</p>
                  <h3 className="mt-4 text-2xl font-black uppercase tracking-tight">Launch Protocol</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    A repeatable process for campaign sequencing, inventory confidence, and fulfillment readiness.
                  </p>
                </article>
                <article className="swiss-diagonal border-2 border-black bg-muted p-6 sm:col-span-2 lg:col-span-1">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Growth</p>
                  <h3 className="mt-4 text-2xl font-black uppercase tracking-tight">Signal Design</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Building high-intent journeys that reduce bounce and improve conversion quality.
                  </p>
                </article>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="border-b-4 border-black bg-muted">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
          <div className="grid gap-8 border-4 border-black bg-background p-6 lg:grid-cols-3 lg:p-8">
            <div>
              <p className="swiss-section-label">{settings.store_name} Inc.</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Aurea Platform</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Structured commerce for premium fragrance teams. Objective design, measurable outcomes.
              </p>
            </div>

            <div>
              <p className="swiss-section-label">Email Address</p>
              <form
                className="mt-3 flex flex-col gap-3 md:flex-row"
                onSubmit={(event) => {
                  event.preventDefault()
                  event.currentTarget.reset()
                }}
              >
                <label htmlFor="newsletter-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  required
                  placeholder="Email Address"
                  className="swiss-input w-full"
                />
                <button type="submit" className="swiss-button swiss-button-primary w-full md:w-auto">
                  Subscribe
                </button>
              </form>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="swiss-section-label">Menu</p>
                <ul className="mt-3 space-y-2 text-sm font-semibold uppercase tracking-[0.12em]">
                  <li>
                    <Link href="#capabilities" className="hover:text-accent">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link href="#investment" className="hover:text-accent">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="#faq" className="hover:text-accent">
                      Security
                    </Link>
                  </li>
                  <li>
                    <Link href="#capabilities" className="hover:text-accent">
                      Integrations
                    </Link>
                  </li>
                  <li>
                    <Link href="#journal" className="hover:text-accent">
                      Changelog
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="swiss-section-label">Connect</p>
                <p className="mt-3 flex items-start gap-2 text-sm font-semibold tracking-[0.08em] break-all sm:break-normal">
                  <Mail className="h-4 w-4" />
                  {settings.contact_email}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>(c) 2026 {settings.store_name} Inc. All Rights Reserved.</p>
          </div>
        </div>
      </footer>

      <ChatWidget
        sessionId={sessionId}
        currentPageUrl={currentPath}
        activeProductId={focusedProductId}
        onOpen={trackChatOpen}
        storeName={settings.store_name}
      />
    </div>
  )
}
