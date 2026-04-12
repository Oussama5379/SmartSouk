"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, Sparkles, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { readClientCache, writeClientCache } from "@/lib/client-cache";
import type {
  MarketingSegment,
  MarketingSegmentsApiResponse,
} from "@/lib/tracking-types";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Article {
  id: string;
  title: string;
  summary: string;
}

interface OverlayConfig {
  labelText: string;
  taglineText: string;
  style: string;
  position: string;
  textAlign: string;
  textColor: string;
  taglineColor: string;
  bgColor: string;
  borderColor: string;
  opacity: number;
  overlayBlur: number;
  bgBlur: number;
  fontSize: number;
  letterSpacing: number;
  padding: number;
  borderWidth: number;
  borderRadius: number;
  showOverlay: boolean;
  showTagline: boolean;
  uppercase: boolean;
  showBorder: boolean;
  textShadow: boolean;
}

interface CaptionItem {
  tone: string;
  caption: string;
  hashtags: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STYLE_PRESETS: Record<string, Partial<OverlayConfig>> = {
  luxury: {
    textColor: "#ffffff",
    taglineColor: "#e8d5b0",
    bgColor: "#1a1008",
    borderColor: "#b98b2e",
    opacity: 88,
    overlayBlur: 0,
    borderWidth: 2,
    borderRadius: 5,
    fontSize: 18,
    letterSpacing: 3,
    padding: 12,
    uppercase: true,
    showBorder: true,
    textShadow: false,
    position: "center",
    textAlign: "center",
  },
  minimal: {
    textColor: "#1a1a1a",
    taglineColor: "#666666",
    bgColor: "#ffffff",
    borderColor: "#dddddd",
    opacity: 92,
    overlayBlur: 0,
    borderWidth: 1,
    borderRadius: 6,
    fontSize: 15,
    letterSpacing: 1,
    padding: 10,
    uppercase: false,
    showBorder: true,
    textShadow: false,
    position: "bottom-center",
    textAlign: "center",
  },
  frosted: {
    textColor: "#ffffff",
    taglineColor: "#ddeeff",
    bgColor: "#ffffff",
    borderColor: "#ffffff",
    opacity: 18,
    overlayBlur: 20,
    borderWidth: 1,
    borderRadius: 16,
    fontSize: 18,
    letterSpacing: 2,
    padding: 18,
    uppercase: false,
    showBorder: true,
    textShadow: true,
    position: "center",
    textAlign: "center",
  },
  bold: {
    textColor: "#ffffff",
    taglineColor: "#ffe0a0",
    bgColor: "#c45d1b",
    borderColor: "#c45d1b",
    opacity: 95,
    overlayBlur: 0,
    borderWidth: 0,
    borderRadius: 4,
    fontSize: 20,
    letterSpacing: 2,
    padding: 14,
    uppercase: true,
    showBorder: false,
    textShadow: false,
    position: "bottom-center",
    textAlign: "center",
  },
  cinematic: {
    textColor: "#ffffff",
    taglineColor: "#999999",
    bgColor: "#000000",
    borderColor: "#000000",
    opacity: 72,
    overlayBlur: 0,
    borderWidth: 0,
    borderRadius: 0,
    fontSize: 22,
    letterSpacing: 5,
    padding: 20,
    uppercase: true,
    showBorder: false,
    textShadow: false,
    position: "bottom-center",
    textAlign: "left",
  },
  outline: {
    textColor: "#ffffff",
    taglineColor: "#ffffff",
    bgColor: "#000000",
    borderColor: "#ffffff",
    opacity: 0,
    overlayBlur: 0,
    borderWidth: 2,
    borderRadius: 0,
    fontSize: 18,
    letterSpacing: 4,
    padding: 12,
    uppercase: true,
    showBorder: true,
    textShadow: true,
    position: "center",
    textAlign: "center",
  },
};

const POSITIONS: Record<string, React.CSSProperties> = {
  center: { top: "50%", left: "50%", transform: "translate(-50%,-50%)" },
  "top-center": { top: "6%", left: "50%", transform: "translateX(-50%)" },
  "top-left": { top: "6%", left: "5%" },
  "top-right": { top: "6%", right: "5%" },
  "bottom-center": { bottom: "6%", left: "50%", transform: "translateX(-50%)" },
  "bottom-left": { bottom: "6%", left: "5%" },
  "bottom-right": { bottom: "6%", right: "5%" },
};

const DEFAULT_ARTICLES: Article[] = [
  {
    id: "a1",
    title: "New Product Launch Spotlight",
    summary:
      "Show the hero product with premium lighting, clean backdrop, and a high-end campaign feel.",
  },
  {
    id: "a2",
    title: "Limited-Time Offer Campaign",
    summary:
      "Focus on urgency, bold hero composition, and a visual that clearly sells the main offer.",
  },
  {
    id: "a3",
    title: "Brand Story Hero Visual",
    summary:
      "Highlight craftsmanship, material quality, and a premium brand mood for social media.",
  },
];

const DEFAULT_OVERLAY: OverlayConfig = {
  labelText: "Campaign Label",
  taglineText: "",
  style: "luxury",
  position: "center",
  textAlign: "center",
  textColor: "#ffffff",
  taglineColor: "#e8d5b0",
  bgColor: "#1a1008",
  borderColor: "#b98b2e",
  opacity: 88,
  overlayBlur: 0,
  bgBlur: 0,
  fontSize: 18,
  letterSpacing: 3,
  padding: 12,
  borderWidth: 2,
  borderRadius: 5,
  showOverlay: true,
  showTagline: true,
  uppercase: true,
  showBorder: true,
  textShadow: false,
};

const MARKETING_SEGMENTS_CACHE_KEY = "dashboard:marketing-segments:v1";
const MARKETING_SEGMENTS_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function computeOverlayStyle(
  cfg: OverlayConfig,
  imageLoaded: boolean,
): React.CSSProperties {
  if (!imageLoaded || !cfg.showOverlay) return { display: "none" };

  const isCinematic = cfg.style === "cinematic";
  const { r, g, b } = hexToRgb(cfg.bgColor);
  const blur = cfg.overlayBlur > 0 ? `blur(${cfg.overlayBlur}px)` : "none";
  const posStyles = isCinematic
    ? {
        bottom: "0",
        left: "0",
        right: "0",
        top: "auto",
        width: "100%",
        maxWidth: "100%",
      }
    : {
        ...(POSITIONS[cfg.position] || POSITIONS.center),
        minWidth: "40%",
        maxWidth: "74%",
      };

  return {
    position: "absolute",
    display: "block",
    background: `rgba(${r},${g},${b},${cfg.opacity / 100})`,
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
    border:
      cfg.showBorder && cfg.borderWidth > 0 && !isCinematic
        ? `${cfg.borderWidth}px solid ${cfg.borderColor}`
        : "none",
    borderRadius: isCinematic ? "0" : `${cfg.borderRadius}px`,
    fontSize: `${cfg.fontSize}px`,
    letterSpacing: `${cfg.letterSpacing}px`,
    textTransform: cfg.uppercase ? "uppercase" : "none",
    textAlign: cfg.textAlign as React.CSSProperties["textAlign"],
    padding: `${cfg.padding}px ${Math.round(cfg.padding * 1.6)}px`,
    wordBreak: "break-word",
    ...posStyles,
  };
}

function parseRecipientEmails(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl);
  if (!response.ok) {
    throw new Error("Unable to prepare generated image for email delivery.");
  }

  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const value = reader.result;
      if (typeof value === "string" && value.startsWith("data:image/")) {
        resolve(value);
        return;
      }

      reject(
        new Error(
          "Generated image could not be converted to a sendable format.",
        ),
      );
    };
    reader.onerror = () => {
      reject(
        new Error(
          "Generated image could not be converted to a sendable format.",
        ),
      );
    };
    reader.readAsDataURL(blob);
  });
}

// ─── COPY BUTTON ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="flex items-center gap-1.5 text-xs font-semibold border border-border rounded-md px-2.5 py-1 hover:border-primary hover:text-primary transition-colors"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── SLIDER ROW ───────────────────────────────────────────────────────────────
function SliderRow({
  label,
  value,
  min,
  max,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-muted-foreground w-28 shrink-0">
        {label}
      </span>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <span className="text-xs font-bold text-primary w-9 text-right shrink-0">
        {value}
        {unit}
      </span>
    </div>
  );
}

// ─── COLOR ROW ────────────────────────────────────────────────────────────────
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-3 py-2">
      <span className="text-xs font-semibold flex-1">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-7 rounded border border-border cursor-pointer bg-background p-0.5"
      />
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  const cachedSegments = useMemo(
    () =>
      readClientCache<MarketingSegment[]>(
        MARKETING_SEGMENTS_CACHE_KEY,
        MARKETING_SEGMENTS_CACHE_MAX_AGE_MS,
      ),
    [],
  );

  // Brand profile
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [audience, setAudience] = useState("");

  // Articles
  const [articles, setArticles] = useState<Article[]>(DEFAULT_ARTICLES);
  const [selectedId, setSelectedId] = useState("a1");
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");

  // Generation state
  const [roughPrompt, setRoughPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [statusTone, setStatusTone] = useState<"normal" | "ok" | "error">(
    "normal",
  );
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [provider, setProvider] = useState("pending");
  const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState("");

  // Image
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const lastObjectUrl = useRef<string | null>(null);

  // Overlay
  const [cfg, setCfg] = useState<OverlayConfig>(DEFAULT_OVERLAY);

  // Captions
  const [captionTone, setCaptionTone] = useState("all");
  const [captionPlatform, setCaptionPlatform] = useState("instagram");
  const [captions, setCaptions] = useState<CaptionItem[]>([]);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [captionError, setCaptionError] = useState("");

  // Email send state
  const [emailRecipients, setEmailRecipients] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailPreviewText, setEmailPreviewText] = useState("");
  const [campaignCopy, setCampaignCopy] = useState("");
  const [isSuggestingEmail, setIsSuggestingEmail] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [segmentOptions, setSegmentOptions] = useState<MarketingSegment[]>(
    cachedSegments ?? [],
  );
  const [segmentsLoading, setSegmentsLoading] = useState(!cachedSegments);
  const [selectedSegmentKey, setSelectedSegmentKey] = useState<string>("manual");

  const updateCfg = useCallback((patch: Partial<OverlayConfig>) => {
    setCfg((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyPreset = useCallback((presetName: string) => {
    const p = STYLE_PRESETS[presetName];
    if (!p) return;
    setCfg((prev) => ({ ...prev, ...p, style: presetName }));
  }, []);

  useEffect(() => {
    return () => {
      if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current);
    };
  }, []);

  const selectedArticle =
    articles.find((a) => a.id === selectedId) || articles[0];

  useEffect(() => {
    if (!emailSubject && selectedArticle?.title) {
      setEmailSubject(selectedArticle.title);
    }
  }, [selectedArticle, emailSubject]);

  useEffect(() => {
    if (campaignCopy || captions.length === 0) {
      return;
    }

    const firstCaption = captions[0];
    const initialCopy = [firstCaption.caption, firstCaption.hashtags]
      .filter(Boolean)
      .join("\n\n");
    setCampaignCopy(initialCopy);
  }, [captions, campaignCopy]);

  useEffect(() => {
    const loadSegments = async (options?: { background?: boolean }) => {
      if (!options?.background) {
        setSegmentsLoading(true);
      }
      try {
        const response = await fetch("/api/marketing/segments", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as MarketingSegmentsApiResponse;
        const segments = Array.isArray(body.segments) ? body.segments : [];
        setSegmentOptions(segments);
        writeClientCache<MarketingSegment[]>(
          MARKETING_SEGMENTS_CACHE_KEY,
          segments,
        );
      } catch {
        // Segmentation is optional; keep manual mode.
      } finally {
        if (!options?.background) {
          setSegmentsLoading(false);
        }
      }
    };

    void loadSegments({ background: !!cachedSegments });
  }, [cachedSegments]);

  const selectedSegment = useMemo(
    () => segmentOptions.find((segment) => segment.key === selectedSegmentKey) ?? null,
    [segmentOptions, selectedSegmentKey],
  );

  const handleUseSegmentRecipients = () => {
    if (!selectedSegment) {
      toast({
        variant: "destructive",
        title: "Select a segment",
        description: "Choose a target segment first.",
      });
      return;
    }

    if (selectedSegment.recipient_emails.length === 0) {
      toast({
        variant: "destructive",
        title: "No recipients available",
        description:
          "This segment currently has no email addresses linked to tracked users.",
      });
      return;
    }

    setEmailRecipients(selectedSegment.recipient_emails.join("\n"));
    toast({
      title: "Recipients loaded",
      description: `${selectedSegment.recipient_emails.length} emails loaded from ${selectedSegment.name}.`,
    });
  };

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (isGenerating || !roughPrompt.trim()) return;

    setIsGenerating(true);
    setStatus("Building prompt…");
    setStatusTone("normal");
    setProvider("processing");

    try {
      // Step 1: build prompt from inputs (no LLM middleware)
      const enhanceRes = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roughPrompt,
          article: selectedArticle,
          profile: { brandName, industry, visualStyle, audience },
        }),
      });
      const enhanceData = await enhanceRes.json();
      const finalPrompt = (enhanceData.prompt || "").trim();
      if (!finalPrompt) throw new Error("No prompt returned.");

      setEnhancedPrompt(finalPrompt);
      setLastGeneratedPrompt(finalPrompt);
      setProvider(enhanceData.provider || "local");

      // Step 2: generate image
      setStatus("Generating image…");
      const imgRes = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt }),
      });

      if (!imgRes.ok) {
        const errData = await imgRes.json().catch(() => ({}));
        throw new Error(
          (errData.error || "Image generation failed.") +
            (errData.details ? ` ${errData.details}` : ""),
        );
      }

      const blob = await imgRes.blob();
      if (!blob || !blob.size) throw new Error("Image response was empty.");

      if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current);
      const objUrl = URL.createObjectURL(blob);
      lastObjectUrl.current = objUrl;
      setImageUrl(objUrl);
      setImageLoaded(false);
      setStatus("Image ready.");
      setStatusTone("ok");
    } catch (err) {
      setStatus((err as Error).message || "Something went wrong.");
      setStatusTone("error");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleAddArticle(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newSummary.trim()) return;
    const article = {
      id: `a${Date.now()}`,
      title: newTitle.trim(),
      summary: newSummary.trim(),
    };
    setArticles((prev) => [article, ...prev]);
    setSelectedId(article.id);
    setNewTitle("");
    setNewSummary("");
  }

  async function handleGenerateCaption() {
    if (isGeneratingCaption) return;
    setIsGeneratingCaption(true);
    setCaptions([]);
    setCaptionError("");

    try {
      const res = await fetch("/api/generate-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article: selectedArticle,
          profile: { brandName, industry, visualStyle, audience },
          tone: captionTone,
          platform: captionPlatform,
          imagePrompt: lastGeneratedPrompt,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Caption generation failed.");
      }
      const data = await res.json();
      setCaptions(Array.isArray(data.captions) ? data.captions : []);
    } catch (err) {
      setCaptionError((err as Error).message || "Caption generation failed.");
    } finally {
      setIsGeneratingCaption(false);
    }
  }

  async function handleSendCampaignEmail() {
    if (isSendingEmail) {
      return;
    }

    const recipients = parseRecipientEmails(emailRecipients);
    if (recipients.length === 0) {
      toast({
        variant: "destructive",
        title: "Recipient emails required",
        description:
          "Add one or more recipient emails separated by commas or new lines.",
      });
      return;
    }

    const subject = emailSubject.trim();
    if (!subject) {
      toast({
        variant: "destructive",
        title: "Subject is required",
        description: "Enter an email subject before sending.",
      });
      return;
    }

    const copy = campaignCopy.trim();
    if (!copy) {
      toast({
        variant: "destructive",
        title: "Campaign copy is required",
        description: "Add the campaign text that should appear in the email.",
      });
      return;
    }

    if (!imageUrl) {
      toast({
        variant: "destructive",
        title: "Image required",
        description: "Generate an image before sending the campaign email.",
      });
      return;
    }

    setIsSendingEmail(true);

    try {
      const emailImageSource = imageUrl.startsWith("blob:")
        ? await blobUrlToDataUrl(imageUrl)
        : imageUrl;

      const response = await fetch("/api/marketing/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_emails: recipients,
          subject,
          campaign_copy: copy,
          image_url: emailImageSource,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        details?: string;
        sent_count?: number;
        rejected?: string[];
      };

      if (!response.ok || !result.success) {
        throw new Error(
          result.details || result.error || "Unable to send campaign email.",
        );
      }

      const sentCount =
        typeof result.sent_count === "number"
          ? result.sent_count
          : recipients.length;
      const rejectedCount = Array.isArray(result.rejected)
        ? result.rejected.length
        : 0;

      toast({
        title: "Campaign email sent",
        description:
          rejectedCount > 0
            ? `Sent to ${sentCount} recipient(s); ${rejectedCount} address(es) were rejected.`
            : `Sent to ${sentCount} recipient(s).`,
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Email sending failed",
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error while sending the campaign email.",
      });
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function handleSuggestEmailDraft() {
    if (isSuggestingEmail) {
      return;
    }

    if (!imageUrl) {
      toast({
        variant: "destructive",
        title: "Generate an image first",
        description:
          "We use the generated visual context to suggest better email copy.",
      });
      return;
    }

    setIsSuggestingEmail(true);

    try {
      const captionText = captions[0]
        ? [captions[0].caption, captions[0].hashtags]
            .filter(Boolean)
            .join("\n\n")
        : "";

      const response = await fetch("/api/marketing/suggest-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article: selectedArticle,
          profile: { brandName, industry, visualStyle, audience },
          imagePrompt: lastGeneratedPrompt || roughPrompt,
          captionText,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        details?: string;
        provider?: string;
        warning?: string;
        subject?: string;
        preview_text?: string;
        campaign_copy?: string;
        cta?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || result.details || "Unable to suggest email draft.",
        );
      }

      const nextSubject = (result.subject || "").trim();
      const nextPreview = (result.preview_text || "").trim();
      const nextBody = (result.campaign_copy || "").trim();
      const nextCta = (result.cta || "").trim();

      if (nextSubject) {
        setEmailSubject(nextSubject);
      }

      if (nextPreview) {
        setEmailPreviewText(nextPreview);
      }

      const mergedCopy = [nextBody, nextCta ? `CTA: ${nextCta}` : ""]
        .filter(Boolean)
        .join("\n\n");

      if (mergedCopy) {
        setCampaignCopy(mergedCopy);
      }

      toast({
        title: "Email draft ready",
        description:
          result.warning ||
          `Draft generated using ${(result.provider || "ai").toString()} based on your image context.`,
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Suggestion failed",
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error while generating email suggestion.",
      });
    } finally {
      setIsSuggestingEmail(false);
    }
  }

  const overlayStyle = computeOverlayStyle(cfg, imageLoaded);
  const shadow = cfg.textShadow
    ? "0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.5)"
    : "none";

  const statusColor =
    statusTone === "error"
      ? "text-destructive"
      : statusTone === "ok"
        ? "text-green-700 dark:text-green-400"
        : "text-foreground";

  return (
    <div className="space-y-6">
      {/* Dashboard header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marketing AI</h1>
        <p className="text-muted-foreground">
          Generate campaign visuals and social media captions with AI.
        </p>
      </div>

      {/* Top grid: Brand + Prompt */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Panel 1: Brand Profile + Articles */}
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-lg mb-4">1. Brand Profile</h2>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Brand name</Label>
                  <Input
                    placeholder="Your brand"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category / Industry</Label>
                  <Input
                    placeholder="perfume, fashion, tech, skincare…"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Visual style</Label>
                  <Input
                    placeholder="minimalist luxury, dark cinematic…"
                    value={visualStyle}
                    onChange={(e) => setVisualStyle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Audience</Label>
                  <Input
                    placeholder="Target audience"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="font-semibold text-lg mb-3">2. Campaign Angle</h2>
              <div className="space-y-2 mb-4">
                {articles.map((a) => (
                  <label
                    key={a.id}
                    className={`block border rounded-lg p-3 cursor-pointer transition-colors ${
                      a.id === selectedId
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="articleChoice"
                        value={a.id}
                        checked={a.id === selectedId}
                        onChange={() => setSelectedId(a.id)}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <p className="text-sm font-semibold">{a.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.summary}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <form
                onSubmit={handleAddArticle}
                className="space-y-2 pt-3 border-t border-dashed"
              >
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Add custom angle
                </p>
                <Input
                  placeholder="Campaign title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
                <Textarea
                  rows={2}
                  placeholder="Short campaign angle or summary"
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Add Angle
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Panel 2: Prompt Input */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">3. Prompt &amp; Generate</h2>
            <form onSubmit={handleGenerate} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Describe the visual</Label>
                <Textarea
                  rows={5}
                  placeholder="Example: product bottle hero shot, dark amber lighting, clean studio background, minimalist feel"
                  value={roughPrompt}
                  onChange={(e) => setRoughPrompt(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={isGenerating} className="w-full">
                <Sparkles className="mr-2 h-4 w-4" />
                {isGenerating ? "Generating…" : "Generate Image"}
              </Button>
            </form>

            <Separator />

            <div className="space-y-1">
              <p className={`text-sm font-semibold ${statusColor}`}>{status}</p>
              <p className="text-xs text-muted-foreground">
                Provider:{" "}
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                  {provider}
                </span>
              </p>
            </div>

            {enhancedPrompt && (
              <div className="space-y-1.5 pt-2 border-t border-dashed">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Prompt sent to FLUX
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {enhancedPrompt}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Panel 3: Result + Overlay Studio */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
            <h2 className="font-semibold text-lg">
              4. Result &amp; Overlay Studio
            </h2>
            <p className="text-xs text-muted-foreground">
              Labels render in HTML/CSS — always crisp, never burned into the
              image.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] items-start">
            {/* Image column */}
            <div className="lg:sticky lg:top-20">
              <div className="relative border border-border rounded-xl overflow-hidden bg-muted aspect-square">
                {!imageLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground/50">
                    <ImageIcon className="h-10 w-10" />
                    <p className="text-sm">Generate an image to begin</p>
                  </div>
                )}
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Generated campaign visual"
                    className="w-full h-full object-cover transition-all duration-300"
                    style={{
                      filter: `blur(${cfg.bgBlur}px)`,
                      display: imageLoaded ? "block" : "none",
                    }}
                    onLoad={() => setImageLoaded(true)}
                  />
                )}
                {/* Overlay */}
                <div style={overlayStyle}>
                  <div
                    style={{
                      fontWeight: 700,
                      lineHeight: 1.15,
                      color: cfg.textColor,
                      textShadow: shadow,
                    }}
                  >
                    {cfg.labelText || "Campaign Label"}
                  </div>
                  {cfg.showTagline && cfg.taglineText && (
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: "0.68em",
                        marginTop: 5,
                        lineHeight: 1.35,
                        color: cfg.taglineColor,
                        textShadow: shadow,
                      }}
                    >
                      {cfg.taglineText}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Tip: use Image blur for a soft focus editorial look.
              </p>
            </div>

            {/* Studio controls */}
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Text Content
                </p>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Main headline</Label>
                    <Input
                      value={cfg.labelText}
                      onChange={(e) => updateCfg({ labelText: e.target.value })}
                      placeholder="Main text"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tagline / sub-copy</Label>
                    <Input
                      value={cfg.taglineText}
                      onChange={(e) =>
                        updateCfg({ taglineText: e.target.value })
                      }
                      placeholder="Optional tagline"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Style Preset &amp; Layout
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Preset</Label>
                    <Select
                      value={cfg.style}
                      onValueChange={(v) => applyPreset(v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="luxury">Luxury Dark</SelectItem>
                        <SelectItem value="minimal">Minimal Clean</SelectItem>
                        <SelectItem value="frosted">Frosted Glass</SelectItem>
                        <SelectItem value="bold">Bold Block</SelectItem>
                        <SelectItem value="cinematic">Cinematic Bar</SelectItem>
                        <SelectItem value="outline">Outline Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Position</Label>
                    <Select
                      value={cfg.position}
                      onValueChange={(v) => updateCfg({ position: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="top-center">Top Center</SelectItem>
                        <SelectItem value="bottom-center">
                          Bottom Center
                        </SelectItem>
                        <SelectItem value="top-left">Top Left</SelectItem>
                        <SelectItem value="top-right">Top Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        <SelectItem value="bottom-right">
                          Bottom Right
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Text align</Label>
                    <Select
                      value={cfg.textAlign}
                      onValueChange={(v) => updateCfg({ textAlign: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Colors
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ColorRow
                    label="Headline"
                    value={cfg.textColor}
                    onChange={(v) => updateCfg({ textColor: v })}
                  />
                  <ColorRow
                    label="Tagline"
                    value={cfg.taglineColor}
                    onChange={(v) => updateCfg({ taglineColor: v })}
                  />
                  <ColorRow
                    label="Background"
                    value={cfg.bgColor}
                    onChange={(v) => updateCfg({ bgColor: v })}
                  />
                  <ColorRow
                    label="Border"
                    value={cfg.borderColor}
                    onChange={(v) => updateCfg({ borderColor: v })}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Typography &amp; Sizing
                </p>
                <div className="space-y-3">
                  <SliderRow
                    label="Font size"
                    value={cfg.fontSize}
                    min={10}
                    max={48}
                    onChange={(v) => updateCfg({ fontSize: v })}
                  />
                  <SliderRow
                    label="Letter spacing"
                    value={cfg.letterSpacing}
                    min={0}
                    max={20}
                    onChange={(v) => updateCfg({ letterSpacing: v })}
                  />
                  <SliderRow
                    label="Padding"
                    value={cfg.padding}
                    min={4}
                    max={48}
                    onChange={(v) => updateCfg({ padding: v })}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Background &amp; Overlay
                </p>
                <div className="space-y-3">
                  <SliderRow
                    label="Overlay opacity"
                    value={cfg.opacity}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(v) => updateCfg({ opacity: v })}
                  />
                  <SliderRow
                    label="Overlay blur"
                    value={cfg.overlayBlur}
                    min={0}
                    max={30}
                    onChange={(v) => updateCfg({ overlayBlur: v })}
                  />
                  <SliderRow
                    label="Image blur"
                    value={cfg.bgBlur}
                    min={0}
                    max={20}
                    onChange={(v) => updateCfg({ bgBlur: v })}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Border &amp; Shape
                </p>
                <div className="space-y-3">
                  <SliderRow
                    label="Border width"
                    value={cfg.borderWidth}
                    min={0}
                    max={8}
                    onChange={(v) => updateCfg({ borderWidth: v })}
                  />
                  <SliderRow
                    label="Border radius"
                    value={cfg.borderRadius}
                    min={0}
                    max={40}
                    onChange={(v) => updateCfg({ borderRadius: v })}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Options
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    {
                      id: "showOverlay",
                      label: "Show overlay",
                      key: "showOverlay" as keyof OverlayConfig,
                    },
                    {
                      id: "showTagline",
                      label: "Show tagline",
                      key: "showTagline" as keyof OverlayConfig,
                    },
                    {
                      id: "uppercase",
                      label: "Uppercase",
                      key: "uppercase" as keyof OverlayConfig,
                    },
                    {
                      id: "showBorder",
                      label: "Show border",
                      key: "showBorder" as keyof OverlayConfig,
                    },
                    {
                      id: "textShadow",
                      label: "Text shadow",
                      key: "textShadow" as keyof OverlayConfig,
                    },
                  ].map(({ id, label, key }) => (
                    <label
                      key={id}
                      className={`flex items-center gap-2 border rounded-full px-3 py-1.5 cursor-pointer text-xs font-semibold transition-colors ${
                        cfg[key]
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border"
                      }`}
                    >
                      <Checkbox
                        id={id}
                        checked={!!cfg[key]}
                        onCheckedChange={(checked) =>
                          updateCfg({ [key]: !!checked })
                        }
                        className="h-3.5 w-3.5"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Caption Studio */}
          <div className="mt-8 pt-6 border-t border-dashed space-y-4">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <h2 className="font-semibold text-lg">
                5. Social Media Captions
              </h2>
              <p className="text-xs text-muted-foreground">
                AI-written captions with tone variants, ready to copy.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">Tone</Label>
                <Select value={captionTone} onValueChange={setCaptionTone}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All three tones</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="fun">Fun &amp; Playful</SelectItem>
                    <SelectItem value="storytelling">Storytelling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Platform</Label>
                <Select
                  value={captionPlatform}
                  onValueChange={setCaptionPlatform}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">X / Twitter</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={handleGenerateCaption}
                disabled={isGeneratingCaption}
                className="mt-auto"
              >
                {isGeneratingCaption ? "Generating…" : "Generate Captions"}
              </Button>
            </div>

            {captionError && (
              <p className="text-sm text-destructive">{captionError}</p>
            )}

            {captions.length > 0 && (
              <div className="grid gap-3">
                {captions.map((c, i) => (
                  <div
                    key={i}
                    className="border border-border rounded-xl p-4 space-y-2 bg-muted/20"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                        {c.tone}
                      </span>
                      <CopyButton
                        text={
                          c.caption + (c.hashtags ? "\n\n" + c.hashtags : "")
                        }
                      />
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {c.caption}
                    </p>
                    {c.hashtags && (
                      <p className="text-xs font-semibold text-primary leading-relaxed">
                        {c.hashtags}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {captions.length === 0 && !captionError && !isGeneratingCaption && (
              <p className="text-sm text-muted-foreground">
                Generate an image first, then create captions here.
              </p>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-dashed space-y-4">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <h2 className="font-semibold text-lg">6. Send Campaign Email</h2>
              <p className="text-xs text-muted-foreground">
                Send your generated creative directly from the app.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Let AI suggest a high-converting subject and body from your
                image context.
              </p>
              <Button
                variant="outline"
                onClick={handleSuggestEmailDraft}
                disabled={isSuggestingEmail || !imageUrl}
              >
                {isSuggestingEmail ? "Suggesting…" : "Suggest with AI"}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>Target segment</Label>
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <Select
                  value={selectedSegmentKey}
                  onValueChange={setSelectedSegmentKey}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select audience segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual recipients</SelectItem>
                    {segmentOptions.map((segment) => (
                      <SelectItem key={segment.key} value={segment.key}>
                        {segment.name} ({segment.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={
                    segmentsLoading ||
                    selectedSegmentKey === "manual" ||
                    !selectedSegment
                  }
                  onClick={handleUseSegmentRecipients}
                >
                  {segmentsLoading ? "Loading…" : "Use Segment Recipients"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Segment users are classified by spending, activity, and product
                interest from tracked events.
              </p>
              {selectedSegment && (
                <div className="rounded-lg border p-3 bg-muted/20 space-y-1.5">
                  <p className="text-sm font-semibold">{selectedSegment.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSegment.summary}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSegment.indicators.slice(0, 3).map((indicator) => (
                      <Badge key={indicator} variant="outline">
                        {indicator}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Recipient emails</Label>
              <Textarea
                rows={3}
                placeholder="customer1@example.com, customer2@example.com"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple emails by comma, semicolon, or new line.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label>Email subject</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="A new signature scent moment"
                />
                {emailPreviewText && (
                  <p className="text-xs text-muted-foreground">
                    Preview text: {emailPreviewText}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Campaign copy</Label>
                <Textarea
                  rows={6}
                  value={campaignCopy}
                  onChange={(e) => setCampaignCopy(e.target.value)}
                  placeholder="Write the campaign copy that will appear in your luxury email."
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Image source: {imageUrl ? "Ready" : "Generate image first"}
              </p>
              <Button
                onClick={handleSendCampaignEmail}
                disabled={isSendingEmail || !imageUrl}
              >
                {isSendingEmail ? "Sending…" : "Send HTML Email"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
