import nodemailer from "nodemailer";

const DEFAULT_SMTP_HOST = "smtp.gmail.com";
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_SENDER_NAME = "Aurea Fragrance House";
const CAMPAIGN_IMAGE_CID_PREFIX = "campaign-image";

let cachedTransporter: nodemailer.Transporter | null = null;

export interface SendCampaignEmailPayload {
  recipientEmails: string[];
  subject: string;
  campaignCopy: string;
  imageUrl: string;
}

export interface SendCampaignEmailResult {
  accepted: string[];
  rejected: string[];
  messageIds: string[];
}

interface ResolvedEmailImage {
  htmlImageSrc: string;
  attachments: NonNullable<nodemailer.SendMailOptions["attachments"]>;
}

function getRequiredEnv(name: "SMTP_USER" | "SMTP_PASSWORD"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const user = getRequiredEnv("SMTP_USER");
  const password = getRequiredEnv("SMTP_PASSWORD");
  const host = process.env.SMTP_HOST?.trim() || DEFAULT_SMTP_HOST;
  const portValue = process.env.SMTP_PORT?.trim();
  const port = Number(portValue || DEFAULT_SMTP_PORT);
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : DEFAULT_SMTP_PORT,
    secure,
    auth: {
      user,
      pass: password,
    },
  });

  return cachedTransporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function copyToParagraphs(campaignCopy: string): string {
  return campaignCopy
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style=\"margin:0 0 16px; color:#2a1f17; font-size:16px; line-height:1.75;\">${escapeHtml(line)}</p>`,
    )
    .join("");
}

function buildPreviewText(subject: string, campaignCopy: string): string {
  const firstMeaningfulLine = campaignCopy
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  const preview = firstMeaningfulLine || subject;
  return preview.length <= 120 ? preview : `${preview.slice(0, 117)}...`;
}

function extensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  };

  return map[mimeType.toLowerCase()] || "jpg";
}

function extensionFromUrl(urlValue: string): string {
  try {
    const pathname = new URL(urlValue).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : "jpg";
  } catch {
    return "jpg";
  }
}

function resolveEmailImage(imageUrl: string, cid: string): ResolvedEmailImage {
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    return {
      htmlImageSrc: trimmed,
      attachments: [],
    };
  }

  const dataUrlMatch = trimmed.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\r\n]+)$/,
  );

  if (dataUrlMatch) {
    const mimeType = dataUrlMatch[1].toLowerCase();
    const base64Payload = dataUrlMatch[2].replace(/\s/g, "");
    const extension = extensionFromMimeType(mimeType);

    return {
      htmlImageSrc: `cid:${cid}`,
      attachments: [
        {
          filename: `campaign-image.${extension}`,
          content: Buffer.from(base64Payload, "base64"),
          contentType: mimeType,
          cid,
          contentDisposition: "inline",
        },
      ],
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const extension = extensionFromUrl(trimmed);

    return {
      htmlImageSrc: `cid:${cid}`,
      attachments: [
        {
          filename: `campaign-image.${extension}`,
          path: trimmed,
          cid,
          contentDisposition: "inline",
        },
      ],
    };
  }

  return {
    htmlImageSrc: trimmed,
    attachments: [],
  };
}

export function buildLuxuryPerfumeEmailHtml(params: {
  subject: string;
  campaignCopy: string;
  imageSrc: string;
  previewText: string;
}): string {
  const { subject, campaignCopy, imageSrc, previewText } = params;
  const paragraphs = copyToParagraphs(campaignCopy);
  const safeImageSrc = escapeHtml(imageSrc.trim());
  const safeSubject = escapeHtml(subject.trim());
  const safePreviewText = escapeHtml(previewText.trim());

  const heroSection = safeImageSrc
    ? `<img src="${safeImageSrc}" alt="Luxury perfume visual" width="568" style="display:block; width:100%; max-width:568px; height:auto; border:0; border-radius:16px;" />`
    : `<div style="padding:42px 20px; text-align:center; border:1px solid #e7d8c4; border-radius:16px; background:linear-gradient(145deg,#fbf4ea,#f4e4d1); color:#5e4430; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:1.7;">Your curated fragrance campaign visual is ready.</div>`;

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${safeSubject}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #f3ece2;
      }

      @media only screen and (max-width: 640px) {
        .mail-shell {
          width: 100% !important;
          border-radius: 0 !important;
        }

        .content-padding {
          padding-left: 18px !important;
          padding-right: 18px !important;
        }

        .headline {
          font-size: 30px !important;
          line-height: 1.2 !important;
        }
      }
    </style>
  </head>
  <body>
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; mso-hide:all; visibility:hidden;">${safePreviewText}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3ece2; padding:28px 12px;">
      <tr>
        <td align="center">
          <table class="mail-shell" role="presentation" cellpadding="0" cellspacing="0" width="620" style="width:620px; max-width:620px; background:#fff9f1; border-radius:22px; overflow:hidden; border:1px solid #ead8c2;">
            <tr>
              <td class="content-padding" style="padding:28px 34px; background:linear-gradient(140deg,#1d120d 0%,#3d271a 60%,#6f4a32 100%);">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px;">
                  <tr>
                    <td style="color:#eedabc; letter-spacing:2.4px; font-size:11px; font-family:Georgia, 'Times New Roman', serif; text-transform:uppercase;">Aurea Fragrance House</td>
                    <td align="right" style="color:#d8bc96; font-size:11px; letter-spacing:1.4px; font-family:Arial, Helvetica, sans-serif; text-transform:uppercase;">Haute Parfumerie</td>
                  </tr>
                </table>
                <h1 class="headline" style="margin:0; color:#f9ece0; font-size:38px; line-height:1.12; font-family:Georgia, 'Times New Roman', serif; font-weight:600;">Where Craft Meets Desire</h1>
                <p style="margin:12px 0 0; color:#e7cfb0; font-size:14px; line-height:1.6; font-family:Arial, Helvetica, sans-serif;">An exclusive scent moment, composed for unforgettable presence.</p>
              </td>
            </tr>
            <tr>
              <td class="content-padding" style="padding:20px 26px 6px; background:#fff9f1;">
                ${heroSection}
              </td>
            </tr>
            <tr>
              <td class="content-padding" style="padding:22px 34px 8px; background:#fff9f1;">
                <h2 style="margin:0 0 14px; color:#2b1b12; font-size:26px; line-height:1.3; font-family:Georgia, 'Times New Roman', serif; font-weight:600;">${safeSubject}</h2>
                ${paragraphs}
              </td>
            </tr>
            <tr>
              <td class="content-padding" style="padding:10px 34px 0; background:#fff9f1;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #ead8c2; border-left:4px solid #7a5339; border-radius:10px;">
                  <tr>
                    <td style="padding:12px 14px; color:#6f513b; font-size:13px; line-height:1.65; font-family:Arial, Helvetica, sans-serif;">
                      Crafted in small batches with elevated ingredients to leave a memorable signature.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="content-padding" style="padding:24px 34px 34px; background:#fff9f1;">
                <a href="#" style="display:inline-block; padding:14px 24px; border-radius:999px; background:#2b1b12; color:#f8e8d2; text-decoration:none; font-size:13px; letter-spacing:1.5px; text-transform:uppercase; font-family:Arial, Helvetica, sans-serif;">Discover The Collection</a>
                <p style="margin:16px 0 0; color:#7a5b46; font-size:12px; line-height:1.6; font-family:Arial, Helvetica, sans-serif;">You are receiving this message as part of the Aurea private fragrance circle.</p>
              </td>
            </tr>
            <tr>
              <td class="content-padding" style="padding:16px 34px 22px; background:#f2dfc9; border-top:1px solid #e4ceb6;">
                <p style="margin:0; color:#4f3728; font-size:12px; letter-spacing:1.2px; text-transform:uppercase; font-family:Arial, Helvetica, sans-serif;">Aurea Fragrance House</p>
                <p style="margin:6px 0 0; color:#7a5d47; font-size:12px; line-height:1.6; font-family:Arial, Helvetica, sans-serif;">Because scent should feel like memory.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}

export async function sendCampaignEmail(
  payload: SendCampaignEmailPayload,
): Promise<SendCampaignEmailResult> {
  const transporter = getTransporter();
  const smtpUser = getRequiredEnv("SMTP_USER");
  const fromAddress = process.env.SMTP_FROM_EMAIL?.trim() || smtpUser;
  const fromName = process.env.SMTP_FROM_NAME?.trim() || DEFAULT_SENDER_NAME;
  const sanitizedFromName = fromName.replace(/\"/g, "");
  const imageCid = `${CAMPAIGN_IMAGE_CID_PREFIX}-${crypto.randomUUID()}@aurea`;
  const resolvedImage = resolveEmailImage(payload.imageUrl, imageCid);
  const previewText = buildPreviewText(payload.subject, payload.campaignCopy);
  const html = buildLuxuryPerfumeEmailHtml({
    subject: payload.subject,
    campaignCopy: payload.campaignCopy,
    imageSrc: resolvedImage.htmlImageSrc,
    previewText,
  });

  const accepted = new Set<string>();
  const rejected = new Set<string>();
  const messageIds: string[] = [];

  for (const recipientEmail of payload.recipientEmails) {
    const info = await transporter.sendMail({
      from: `"${sanitizedFromName}" <${fromAddress}>`,
      to: recipientEmail,
      subject: payload.subject,
      text: `${previewText}\n\n${payload.campaignCopy}`,
      html,
      attachments:
        resolvedImage.attachments.length > 0
          ? resolvedImage.attachments
          : undefined,
    });

    toStringArray(info.accepted).forEach((entry) => accepted.add(entry));
    toStringArray(info.rejected).forEach((entry) => rejected.add(entry));
    if (typeof info.messageId === "string" && info.messageId.length > 0) {
      messageIds.push(info.messageId);
    }
  }

  return {
    accepted: Array.from(accepted),
    rejected: Array.from(rejected),
    messageIds,
  };
}
