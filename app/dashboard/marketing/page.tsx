"use client"

import { useState } from "react"
import { products } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { Copy, Instagram, Lightbulb, Image, Hash, Clock, Check, Sparkles, Loader2, RotateCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface CampaignResult {
  instagram_caption: string
  hashtags: string[]
  image_prompt: string
  strategy_tip: string
}

interface ContentVariant {
  tone: string
  copy: string
  hashtags: string
  cta: string
  bestTime: string
  seoKeywords: string
}

export default function MarketingPage() {
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [campaignGoal, setCampaignGoal] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showVariants, setShowVariants] = useState(false)
  const [contentVariants, setContentVariants] = useState<ContentVariant[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>("")
  const [generatingImage, setGeneratingImage] = useState(false)

  const handleGenerate = async () => {
    if (!selectedProduct || !campaignGoal) return

    setIsLoading(true)
    setResult(null)

    try {
      const product = products.find((p) => p.id === selectedProduct)
      const response = await fetch("/api/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          goal: campaignGoal,
        }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error("[v0] Marketing API error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const generateContentVariants = async () => {
    if (!selectedProduct || !campaignGoal) return

    setLoadingVariants(true)
    try {
      const product = products.find((p) => p.id === selectedProduct)
      const response = await fetch("/api/content-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: product?.name,
          audience: "E-commerce customers",
          campaignGoal,
        }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
        }
      }

      try {
        // Parse JSON from the response
        const jsonMatch = fullText.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          setContentVariants(parsed)
          setShowVariants(true)
        }
      } catch (e) {
        console.error("[v0] Failed to parse variants:", e)
      }
    } catch (error) {
      console.error("[v0] Variants API error:", error)
    } finally {
      setLoadingVariants(false)
    }
  }

  const generateProductImage = async () => {
    if (!result) return

    setGeneratingImage(true)
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: products.find((p) => p.id === selectedProduct)?.name,
          prompt: result.image_prompt,
        }),
      })

      const data = await response.json()
      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl)
      }
    } catch (error) {
      console.error("[v0] Image generation error:", error)
    } finally {
      setGeneratingImage(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marketing AI Assistant</h1>
        <p className="text-muted-foreground">
          Generate compelling social media campaigns for your products using AI.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Generator</CardTitle>
            <CardDescription>
              Select a product and describe your campaign goal to generate marketing content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="product">Product to Promote</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center gap-2">
                        <span>{product.name}</span>
                        <span className="text-muted-foreground">- {product.price_tnd} TND</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal">Campaign Goal</Label>
              <Input
                id="goal"
                placeholder="e.g., Mother's Day flash sale, Ramadan promotion..."
                value={campaignGoal}
                onChange={(e) => setCampaignGoal(e.target.value)}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!selectedProduct || !campaignGoal || isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2" />
                  Generating Campaign...
                </>
              ) : (
                "Generate Campaign"
              )}
            </Button>

            {/* Quick Suggestions */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Quick suggestions:</p>
              <div className="flex flex-wrap gap-2">
                {["Mother's Day Sale", "Ramadan Special", "Summer Collection", "New Arrival"].map(
                  (suggestion) => (
                    <Badge
                      key={suggestion}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => setCampaignGoal(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="space-y-4">
          {!result && !isLoading && (
            <Card className="flex h-full min-h-[400px] items-center justify-center">
              <CardContent className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Lightbulb className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Ready to Create</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Select a product and enter your campaign goal to generate AI-powered marketing
                  content.
                </p>
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <Card className="flex h-full min-h-[400px] items-center justify-center">
              <CardContent className="text-center">
                <Spinner className="mx-auto mb-4 h-8 w-8" />
                <h3 className="text-lg font-semibold">Crafting Your Campaign</h3>
                <p className="text-sm text-muted-foreground">
                  Our AI is creating compelling content for you...
                </p>
              </CardContent>
            </Card>
          )}

          {result && (
            <div className="space-y-4">
              {/* Instagram Caption */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Instagram className="h-5 w-5 text-pink-500" />
                    <CardTitle className="text-base">Instagram Caption (Default)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm">{result.instagram_caption}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => copyToClipboard(result.instagram_caption, "caption")}
                  >
                    {copiedField === "caption" ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {copiedField === "caption" ? "Copied!" : "Copy"}
                  </Button>
                </CardContent>
              </Card>

              {/* Caption Tone Variants */}
              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    Caption Tone Variants
                  </CardTitle>
                  <CardDescription>3 versions optimized for different audiences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Professional Tone */}
                  <div className="p-4 rounded-lg border bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-blue-600">Professional</Badge>
                      <span className="text-xs text-muted-foreground">Corporate, B2B</span>
                    </div>
                    <p className="text-sm mb-3">
                      Discover authentic Tunisian craftsmanship. Our {products.find((p) => p.id === selectedProduct)?.name} represents generations of artisanal excellence. Premium quality, sustainable practices. Perfect for discerning customers who value heritage and authenticity.
                    </p>
                    <div className="text-xs text-muted-foreground mb-2">
                      <strong>CTA:</strong> Shop now for authentic heritage pieces
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          `Discover authentic Tunisian craftsmanship. Our ${products.find((p) => p.id === selectedProduct)?.name} represents generations of artisanal excellence. Premium quality, sustainable practices. Perfect for discerning customers who value heritage and authenticity. Shop now for authentic heritage pieces`,
                          "prof-caption"
                        )
                      }
                    >
                      {copiedField === "prof-caption" ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      {copiedField === "prof-caption" ? "Copied!" : "Copy"}
                    </Button>
                  </div>

                  {/* Fun/Casual Tone */}
                  <div className="p-4 rounded-lg border bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-orange-600">Fun & Casual</Badge>
                      <span className="text-xs text-muted-foreground">Instagram, TikTok</span>
                    </div>
                    <p className="text-sm mb-3">
                      ✨ Your vibe called and this {products.find((p) => p.id === selectedProduct)?.name} answered! Handmade with love by Tunisian artisans who've perfected their craft over generations. Add some soul to your space—because mass-produced is so last season. 🌍💫
                    </p>
                    <div className="text-xs text-muted-foreground mb-2">
                      <strong>CTA:</strong> Get yours before they're gone 🔥
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          `✨ Your vibe called and this ${products.find((p) => p.id === selectedProduct)?.name} answered! Handmade with love by Tunisian artisans who've perfected their craft over generations. Add some soul to your space—because mass-produced is so last season. 🌍💫 Get yours before they're gone 🔥`,
                          "fun-caption"
                        )
                      }
                    >
                      {copiedField === "fun-caption" ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      {copiedField === "fun-caption" ? "Copied!" : "Copy"}
                    </Button>
                  </div>

                  {/* Storytelling Tone */}
                  <div className="p-4 rounded-lg border bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-rose-600">Storytelling</Badge>
                      <span className="text-xs text-muted-foreground">Emotional connection</span>
                    </div>
                    <p className="text-sm mb-3">
                      Meet {products.find((p) => p.id === selectedProduct)?.name}—each one tells a story. Handcrafted by artisans in the heart of Tunisia, carrying forward traditions that have survived centuries. When you choose this piece, you're not just buying something beautiful. You're supporting families, preserving culture, and bringing authentic heritage into your home. Every detail matters. Every stitch counts.
                    </p>
                    <div className="text-xs text-muted-foreground mb-2">
                      <strong>CTA:</strong> Be part of the story. Own a piece of Tunisia.
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          `Meet ${products.find((p) => p.id === selectedProduct)?.name}—each one tells a story. Handcrafted by artisans in the heart of Tunisia, carrying forward traditions that have survived centuries. When you choose this piece, you're not just buying something beautiful. You're supporting families, preserving culture, and bringing authentic heritage into your home. Every detail matters. Every stitch counts. Be part of the story. Own a piece of Tunisia.`,
                          "story-caption"
                        )
                      }
                    >
                      {copiedField === "story-caption" ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      {copiedField === "story-caption" ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Hashtags & Best Time to Post */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Hash className="h-5 w-5 text-blue-500" />
                      <CardTitle className="text-base">Hashtags</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {result.hashtags.map((tag, i) => (
                        <Badge key={i} variant="secondary">
                          {tag.startsWith("#") ? tag : `#${tag}`}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => copyToClipboard(result.hashtags.join(" "), "hashtags")}
                    >
                      {copiedField === "hashtags" ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      {copiedField === "hashtags" ? "Copied!" : "Copy All"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-transparent">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-600" />
                      <CardTitle className="text-base">Best Time to Post</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-white rounded border">
                      <p className="text-sm font-semibold text-amber-900">Thursday 7-9 PM</p>
                      <p className="text-xs text-muted-foreground mt-1">Highest engagement for Tunisian diaspora</p>
                    </div>
                    <div className="p-3 bg-white rounded border">
                      <p className="text-sm font-semibold text-amber-900">Friday 6-8 PM</p>
                      <p className="text-xs text-muted-foreground mt-1">Weekend browsing peak time</p>
                    </div>
                    <div className="p-3 bg-white rounded border">
                      <p className="text-sm font-semibold text-amber-900">Tuesday 2-4 PM</p>
                      <p className="text-xs text-muted-foreground mt-1">Business buyer activity high</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Image Prompt & Generated Image */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image className="h-5 w-5 text-purple-500" />
                      <CardTitle className="text-base">AI Image Generation</CardTitle>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={generateProductImage}
                      disabled={generatingImage}
                    >
                      {generatingImage ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Image
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {generatedImageUrl ? (
                    <div className="space-y-3">
                      <img
                        src={generatedImageUrl}
                        alt="Generated product image"
                        className="w-full rounded-lg border"
                      />
                      <a
                        href={generatedImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Download Full Image
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">{result.image_prompt}</p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(result.image_prompt, "image")}
                  >
                    {copiedField === "image" ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {copiedField === "image" ? "Copied!" : "Copy Prompt"}
                  </Button>
                </CardContent>
              </Card>

              {/* Strategy Tip */}
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Strategy Tip</CardTitle>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={generateContentVariants}
                      disabled={loadingVariants}
                    >
                      {loadingVariants ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <RotateCw className="mr-2 h-4 w-4" />
                          Content Variants
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{result.strategy_tip}</p>
                </CardContent>
              </Card>

              {/* Content Variants */}
              {showVariants && contentVariants.length > 0 && (
                <Card className="border-green-200 bg-gradient-to-br from-green-50 to-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-green-600" />
                      Content Variants
                    </CardTitle>
                    <CardDescription>
                      Multiple versions optimized for different audiences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {contentVariants.map((variant, idx) => (
                      <div key={idx} className="space-y-3 p-4 rounded-lg border bg-white">
                        <div className="flex items-center gap-2">
                          <Badge>{variant.tone}</Badge>
                          <span className="text-sm font-medium">Variant {idx + 1}</span>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Copy
                          </p>
                          <p className="text-sm">{variant.copy}</p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Call to Action
                          </p>
                          <p className="text-sm font-medium text-primary">{variant.cta}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="font-semibold text-muted-foreground">Best Time</p>
                            <p>{variant.bestTime}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground">SEO Keywords</p>
                            <p>{variant.seoKeywords}</p>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => copyToClipboard(variant.copy, `variant-${idx}`)}
                        >
                          {copiedField === `variant-${idx}` ? (
                            <Check className="mr-2 h-4 w-4" />
                          ) : (
                            <Copy className="mr-2 h-4 w-4" />
                          )}
                          {copiedField === `variant-${idx}` ? "Copied!" : "Copy Variant"}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
