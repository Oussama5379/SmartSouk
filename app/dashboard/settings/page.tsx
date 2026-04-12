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

type BudgetRange = "low" | "medium" | "high"
type PreferredFamily = "Floral" | "Oriental" | "Fresh" | "Woody"
type TargetOccasion = "Daily" | "Wedding" | "Evening" | "Gift"
type Mood = "Romantic" | "Confident" | "Energetic" | "Mysterious"

interface RecommendationProfile {
  username: string
  budget_range: BudgetRange | ""
  preferred_family: PreferredFamily | ""
  target_occasion: TargetOccasion | ""
  mood: Mood | ""
}

const emptyRecommendationProfile: RecommendationProfile = {
  username: "",
  budget_range: "",
  preferred_family: "",
  target_occasion: "",
  mood: "",
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
  const [savingProfile, setSavingProfile] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [profileErrorMessage, setProfileErrorMessage] = useState("")
  const [profileSuccessMessage, setProfileSuccessMessage] = useState("")
  const [profile, setProfile] = useState<RecommendationProfile>(emptyRecommendationProfile)

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

    const loadProfile = async () => {
      try {
        const response = await fetch("/api/onboarding/status", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        })

        if (!response.ok) {
          return
        }

        const body = (await response.json()) as {
          preferences?: Partial<RecommendationProfile> | null
        }

        if (!body.preferences) {
          return
        }

        setProfile((current) => ({ ...current, ...body.preferences }))
      } catch {
        // Ignore profile prefill errors.
      }
    }

    void loadProfile()
  }, [])

  const handleSaveRecommendationProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileErrorMessage("")
    setProfileSuccessMessage("")

    if (
      profile.username.trim().length < 2 ||
      !profile.budget_range ||
      !profile.preferred_family ||
      !profile.target_occasion ||
      !profile.mood
    ) {
      setProfileErrorMessage("Please complete all recommendation profile fields.")
      return
    }

    setSavingProfile(true)

    try {
      const response = await fetch("/api/onboarding/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })

      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setProfileErrorMessage(body.error ?? "Failed to save recommendation profile")
        return
      }

      setProfileSuccessMessage("Recommendation profile updated")
    } catch {
      setProfileErrorMessage("Failed to save recommendation profile")
    } finally {
      setSavingProfile(false)
    }
  }

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
      <Card>
        <CardHeader>
          <CardTitle>Recommendation Profile</CardTitle>
          <CardDescription>
            Update your personalization profile for graph-based recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSaveRecommendationProfile(event)}>
            {profileErrorMessage ? (
              <p className="text-sm text-destructive">{profileErrorMessage}</p>
            ) : null}
            {profileSuccessMessage ? (
              <p className="text-sm text-green-700">{profileSuccessMessage}</p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-username">Username</Label>
                <Input
                  id="profile-username"
                  value={profile.username}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, username: event.target.value }))
                  }
                  placeholder="e.g. Sarah"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-budget">Budget Range</Label>
                <select
                  id="profile-budget"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.budget_range}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      budget_range: event.target.value as RecommendationProfile["budget_range"],
                    }))
                  }
                >
                  <option value="">Select budget</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="profile-family">Preferred Family</Label>
                <select
                  id="profile-family"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.preferred_family}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      preferred_family: event.target.value as RecommendationProfile["preferred_family"],
                    }))
                  }
                >
                  <option value="">Select family</option>
                  <option value="Floral">Floral</option>
                  <option value="Oriental">Oriental</option>
                  <option value="Fresh">Fresh</option>
                  <option value="Woody">Woody</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-occasion">Target Occasion</Label>
                <select
                  id="profile-occasion"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.target_occasion}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      target_occasion: event.target.value as RecommendationProfile["target_occasion"],
                    }))
                  }
                >
                  <option value="">Select occasion</option>
                  <option value="Daily">Daily</option>
                  <option value="Wedding">Wedding</option>
                  <option value="Evening">Evening</option>
                  <option value="Gift">Gift</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-mood">Mood</Label>
                <select
                  id="profile-mood"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={profile.mood}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      mood: event.target.value as RecommendationProfile["mood"],
                    }))
                  }
                >
                  <option value="">Select mood</option>
                  <option value="Romantic">Romantic</option>
                  <option value="Confident">Confident</option>
                  <option value="Energetic">Energetic</option>
                  <option value="Mysterious">Mysterious</option>
                </select>
              </div>
            </div>

            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save Recommendation Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

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
