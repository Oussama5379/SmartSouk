import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { getStoreSettings } from "@/lib/store-data"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const fallbackMetadata: Metadata = {
  title: "Aurea - Intelligent Fragrance Commerce",
  description:
    "A high-clarity commerce platform for premium fragrance products, campaign automation, and customer insights.",
  generator: "v0.app",
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getStoreSettings()
    const siteIconUrl = settings.site_icon_url?.trim()

    return {
      ...fallbackMetadata,
      title: `${settings.store_name} - Authentic Tunisian Craftsmanship`,
      description: settings.store_description,
      icons: siteIconUrl
        ? {
            icon: [{ url: siteIconUrl }],
            apple: siteIconUrl,
          }
        : fallbackMetadata.icons,
    }
  } catch {
    return fallbackMetadata
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} swiss-noise font-sans antialiased`}>
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
