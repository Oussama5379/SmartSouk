"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { readClientCache, writeClientCache } from "@/lib/client-cache"
import type { StoreSettings } from "@/lib/store-types"

interface StoreSettingsResponse {
  settings?: StoreSettings
  error?: string
}

const fallbackSettings: StoreSettings = {
  store_name: "SmartSouk",
  store_description:
    "Discover handcrafted ceramics, woven rugs, and organic oils from Tunisia. Every piece tells a story of tradition.",
  contact_email: "contact@smartsouk.tn",
  hero_image_url: "",
  site_icon_url: "",
  feature_one_title: "100% Natural",
  feature_one_description: "Organic oils and natural materials",
  feature_two_title: "Worldwide Shipping",
  feature_two_description: "Delivery to your doorstep",
  feature_three_title: "Handcrafted",
  feature_three_description: "By skilled local artisans",
  updated_at: Date.now(),
}

const SETTINGS_CACHE_KEY = "dashboard:settings:v1"
const SETTINGS_CACHE_MAX_AGE_MS = 10 * 60 * 1000

export default function SettingsPage() {
  const cachedSettings = useMemo(
    () => readClientCache<StoreSettings>(SETTINGS_CACHE_KEY, SETTINGS_CACHE_MAX_AGE_MS),
    []
  )
  const [settings, setSettings] = useState<StoreSettings>(cachedSettings ?? fallbackSettings)
  const [loading, setLoading] = useState(!cachedSettings)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const loadSettings = async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setLoading(true)
    }
    setErrorMessage("")

    try {
      const response = await fetch("/api/store/settings", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      const body = (await response.json()) as StoreSettingsResponse
      if (!response.ok || !body.settings) {
        setErrorMessage(body.error ?? "Failed to load settings")
        return
      }

      setSettings(body.settings)
      writeClientCache<StoreSettings>(SETTINGS_CACHE_KEY, body.settings)
    } catch {
      setErrorMessage("Failed to load settings")
    } finally {
      if (!options?.background) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadSettings({ background: !!cachedSettings })
  }, [cachedSettings])

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await fetch("/api/store/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_name: settings.store_name,
          store_description: settings.store_description,
          contact_email: settings.contact_email,
          hero_image_url: settings.hero_image_url ?? "",
          site_icon_url: settings.site_icon_url ?? "",
          feature_one_title: settings.feature_one_title ?? "",
          feature_one_description: settings.feature_one_description ?? "",
          feature_two_title: settings.feature_two_title ?? "",
          feature_two_description: settings.feature_two_description ?? "",
          feature_three_title: settings.feature_three_title ?? "",
          feature_three_description: settings.feature_three_description ?? "",
        }),
      })

      const body = (await response.json()) as StoreSettingsResponse
      if (!response.ok || !body.settings) {
        setErrorMessage(body.error ?? "Failed to save settings")
        return
      }

      setSettings(body.settings)
      writeClientCache<StoreSettings>(SETTINGS_CACHE_KEY, body.settings)
      setSuccessMessage("Settings saved successfully")
    } catch {
      setErrorMessage("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your store preferences and configurations.
        </p>
      </div>

      {errorMessage && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-sm text-green-700">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Store Information */}
      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
          <CardDescription>
            Basic information shown across your storefront and dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSaveSettings(event)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="store-name">Store Name</Label>
                <Input
                  id="store-name"
                  value={settings.store_name}
                  disabled={loading}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      store_name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Contact Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.contact_email}
                  disabled={loading}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      contact_email: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Store Description</Label>
              <Textarea
                id="description"
                value={settings.store_description}
                disabled={loading}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    store_description: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero-image">Hero Image URL</Label>
              <Input
                id="hero-image"
                value={settings.hero_image_url ?? ""}
                disabled={loading}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    hero_image_url: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                This image is used as the background behind the homepage description block.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="site-icon">Website Icon URL (Favicon)</Label>
              <Input
                id="site-icon"
                value={settings.site_icon_url ?? ""}
                disabled={loading}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    site_icon_url: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Use a square PNG/SVG URL. This updates the browser tab icon.
              </p>
            </div>

            {settings.hero_image_url && (
              <div className="overflow-hidden rounded-lg border">
                <div
                  className="h-36 bg-cover bg-center"
                  style={{ backgroundImage: `url("${settings.hero_image_url.replace(/"/g, '\\"')}")` }}
                />
              </div>
            )}

            {settings.site_icon_url && (
              <div className="flex items-center gap-3 rounded-lg border p-3 w-fit">
                <img src={settings.site_icon_url} alt="Site icon preview" className="h-8 w-8 rounded" />
                <p className="text-xs text-muted-foreground">Current favicon preview</p>
              </div>
            )}

            <Separator />

            <div className="space-y-3">
              <h3 className="text-base font-semibold">Homepage Highlight Cards</h3>
              <p className="text-xs text-muted-foreground">
                Customize the three value cards shown on the storefront homepage.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-dashed">
                <CardContent className="pt-4 space-y-2">
                  <Label htmlFor="feature-one-title">Card 1 Title</Label>
                  <Input
                    id="feature-one-title"
                    value={settings.feature_one_title ?? ""}
                    disabled={loading}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        feature_one_title: event.target.value,
                      }))
                    }
                  />
                  <Label htmlFor="feature-one-desc">Card 1 Description</Label>
                  <Input
                    id="feature-one-desc"
                    value={settings.feature_one_description ?? ""}
                    disabled={loading}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        feature_one_description: event.target.value,
                      }))
                    }
                  />
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardContent className="pt-4 space-y-2">
                  <Label htmlFor="feature-two-title">Card 2 Title</Label>
                  <Input
                    id="feature-two-title"
                    value={settings.feature_two_title ?? ""}
                    disabled={loading}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        feature_two_title: event.target.value,
                      }))
                    }
                  />
                  <Label htmlFor="feature-two-desc">Card 2 Description</Label>
                  <Input
                    id="feature-two-desc"
                    value={settings.feature_two_description ?? ""}
                    disabled={loading}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        feature_two_description: event.target.value,
                      }))
                    }
                  />
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardContent className="pt-4 space-y-2">
                  <Label htmlFor="feature-three-title">Card 3 Title</Label>
                  <Input
                    id="feature-three-title"
                    value={settings.feature_three_title ?? ""}
                    disabled={loading}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        feature_three_title: event.target.value,
                      }))
                    }
                  />
                  <Label htmlFor="feature-three-desc">Card 3 Description</Label>
                  <Input
                    id="feature-three-desc"
                    value={settings.feature_three_description ?? ""}
                    disabled={loading}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        feature_three_description: event.target.value,
                      }))
                    }
                  />
                </CardContent>
              </Card>
            </div>

            <Button type="submit" disabled={saving || loading}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* AI Assistant Settings */}
      <Card>
        <CardHeader>
          <CardTitle>AI Assistant Settings</CardTitle>
          <CardDescription>
            Configure your AI-powered sales and marketing assistants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Sales Chat Widget</Label>
              <p className="text-sm text-muted-foreground">
                Enable the AI chat assistant on your storefront
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Marketing AI</Label>
              <p className="text-sm text-muted-foreground">
                Enable AI-powered marketing campaign generation
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Recommendations</Label>
              <p className="text-sm text-muted-foreground">
                Let AI suggest products based on customer behavior
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose what alerts and updates you receive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Low Stock Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when products are running low
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>New Order Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive alerts for new customer orders
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly Analytics Report</Label>
              <p className="text-sm text-muted-foreground">
                Get a summary of your store performance every week
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions for your store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled>
            Reset All Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
