import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { getStoreSettings } from "@/lib/store-data"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

const fallbackMetadata: Metadata = {
  title: "SmartSouk - Authentic Tunisian Craftsmanship",
  description:
    "Discover handcrafted ceramics, woven rugs, and organic oils from Tunisia. Powered by AI for smart shopping and marketing.",
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
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
