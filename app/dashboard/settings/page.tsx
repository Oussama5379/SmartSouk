"use client"

import { FormEvent, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
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
  updated_at: Date.now(),
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings>(fallbackSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const loadSettings = async () => {
    setLoading(true)
    setErrorMessage("")

    try {
      const response = await fetch("/api/store/settings", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })

      const body = (await response.json()) as StoreSettingsResponse
      if (!response.ok || !body.settings) {
        setErrorMessage(body.error ?? "Failed to load settings")
        return
      }

      setSettings(body.settings)
    } catch {
      setErrorMessage("Failed to load settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

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
        }),
      })

      const body = (await response.json()) as StoreSettingsResponse
      if (!response.ok || !body.settings) {
        setErrorMessage(body.error ?? "Failed to save settings")
        return
      }

      setSettings(body.settings)
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

            {settings.hero_image_url && (
              <div className="overflow-hidden rounded-lg border">
                <div
                  className="h-36 bg-cover bg-center"
                  style={{ backgroundImage: `url("${settings.hero_image_url.replace(/"/g, '\\"')}")` }}
                />
              </div>
            )}

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
