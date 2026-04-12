import { NextResponse } from "next/server";
import { sendCampaignEmail, type SendCampaignEmailPayload } from "@/lib/email";

export const runtime = "nodejs";

export interface SendEmailRequestBody {
  recipient_emails: string[];
  subject: string;
  campaign_copy: string;
  image_url: string;
}

type ValidationResult =
  | { valid: true; data: SendEmailRequestBody }
  | { valid: false; error: string };

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidImageUrl(urlValue: string): boolean {
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(urlValue)) {
    return true;
  }

  try {
    const url = new URL(urlValue);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateSendEmailBody(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  const body = input as Partial<SendEmailRequestBody>;
  const recipients = Array.isArray(body.recipient_emails)
    ? body.recipient_emails.map((entry) => normalizeText(entry)).filter(Boolean)
    : [];

  if (recipients.length === 0) {
    return {
      valid: false,
      error: "recipient_emails must include at least one email address.",
    };
  }

  if (recipients.some((recipient) => !isValidEmail(recipient))) {
    return {
      valid: false,
      error: "recipient_emails contains one or more invalid email addresses.",
    };
  }

  const subject = normalizeText(body.subject);
  if (!subject) {
    return { valid: false, error: "subject is required." };
  }

  const campaignCopy = normalizeText(body.campaign_copy);
  if (!campaignCopy) {
    return { valid: false, error: "campaign_copy is required." };
  }

  const imageUrl = normalizeText(body.image_url);
  if (!imageUrl) {
    return { valid: false, error: "image_url is required." };
  }

  if (!isValidImageUrl(imageUrl)) {
    return {
      valid: false,
      error: "image_url must be a valid http/https URL or data:image URL.",
    };
  }

  return {
    valid: true,
    data: {
      recipient_emails: Array.from(new Set(recipients)),
      subject,
      campaign_copy: campaignCopy,
      image_url: imageUrl,
    },
  };
}

export async function POST(request: Request) {
  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON payload.",
      },
      { status: 400 },
    );
  }

  const validation = validateSendEmailBody(parsedBody);
  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: validation.error,
      },
      { status: 400 },
    );
  }

  const payload: SendCampaignEmailPayload = {
    recipientEmails: validation.data.recipient_emails,
    subject: validation.data.subject,
    campaignCopy: validation.data.campaign_copy,
    imageUrl: validation.data.image_url,
  };

  try {
    const result = await sendCampaignEmail(payload);

    return NextResponse.json(
      {
        success: true,
        sent_count: result.accepted.length,
        rejected: result.rejected,
        message_ids: result.messageIds,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const details =
      error instanceof Error ? error.message : "Unknown email delivery error.";

    return NextResponse.json(
      {
        success: false,
        error: "Failed to send campaign email.",
        details,
      },
      { status: 500 },
    );
  }
}
