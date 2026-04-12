'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { StoreProduct } from '@/lib/store-types'
import {
  Mail,
  Send,
  Clock,
  Users,
  TrendingUp,
  Copy,
  Check,
  Loader2,
} from 'lucide-react'

interface EmailSequence {
  emails: Array<{
    subject: string
    previewText: string
    body: string
    cta: string
  }>
  sendTiming: string
  metrics: string
  abtesting: string[]
}

export default function EmailCampaignsPage() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [campaignType, setCampaignType] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [segment, setSegment] = useState('')
  const [loading, setLoading] = useState(false)
  const [sequence, setSequence] = useState<EmailSequence | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/store/products', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const body = (await response.json()) as { products?: StoreProduct[] }
        setProducts(Array.isArray(body.products) ? body.products : [])
      } catch {
        // Keep products empty if API is unavailable.
      }
    }

    void loadProducts()
  }, [])

  const generateCampaign = async () => {
    if (!campaignType || !selectedProduct || !segment) return

    setLoading(true)
    try {
      const product = products.find((p) => p.id === selectedProduct)
      const response = await fetch('/api/email-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignType,
          product: product?.name,
          customerSegment: segment,
        }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
        }
      }

      try {
        const jsonMatch = fullText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          setSequence(parsed)
        }
      } catch (e) {
        console.error('[v0] Failed to parse email campaign:', e)
      }
    } catch (error) {
      console.error('[v0] Email campaign API error:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyEmail = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Campaign Builder</h1>
        <p className="text-muted-foreground">
          Generate complete email sequences optimized for conversions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Configuration</CardTitle>
            <CardDescription>Set up your email campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Campaign Type</Label>
              <Select value={campaignType} onValueChange={setCampaignType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="promotional">Promotional</SelectItem>
                  <SelectItem value="abandoned-cart">Abandoned Cart</SelectItem>
                  <SelectItem value="welcome">Welcome Series</SelectItem>
                  <SelectItem value="upsell">Upsell</SelectItem>
                  <SelectItem value="win-back">Win Back</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Product to Feature</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Segment</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select segment..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high-value">High-Value Customers</SelectItem>
                  <SelectItem value="new">New Customers</SelectItem>
                  <SelectItem value="inactive">Inactive Users</SelectItem>
                  <SelectItem value="vip">VIP Members</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={generateCampaign}
              disabled={!campaignType || !selectedProduct || !segment || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Generate Sequence
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Email Sequence Display */}
        <div className="lg:col-span-2">
          {sequence && (
            <div className="space-y-4">
              {/* Sequence Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Campaign Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-sm">Send Timing</p>
                      <p className="text-sm text-muted-foreground">{sequence.sendTiming}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-sm">Target Metrics</p>
                      <p className="text-sm text-muted-foreground">{sequence.metrics}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Individual Emails */}
              {sequence.emails.map((email, idx) => (
                <Card key={idx} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className="mb-2">Email {idx + 1}</Badge>
                        <CardTitle className="text-base">{email.subject}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{email.previewText}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">EMAIL BODY</p>
                      <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                        {email.body}
                      </div>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-lg border-l-2 border-l-primary">
                      <p className="text-sm font-semibold text-primary">{email.cta}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => copyEmail(email.body, idx)}
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Email
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {/* A/B Testing Suggestions */}
              {sequence.abtesting.length > 0 && (
                <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-transparent">
                  <CardHeader>
                    <CardTitle className="text-base">A/B Testing Suggestions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {sequence.abtesting.map((test, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2">
                          <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold">{idx + 1}</span>
                          </div>
                          <p className="text-sm">{test}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {!sequence && !loading && (
            <Card className="flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center">
                <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Campaign Yet</h3>
                <p className="text-muted-foreground mt-2">
                  Configure your campaign and click generate to create an email sequence.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
