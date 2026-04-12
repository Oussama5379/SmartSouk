import nodemailer from "nodemailer";

const DEFAULT_SMTP_HOST = "smtp.gmail.com";
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_SENDER_NAME = "Aurea Fragrance House";

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

export function buildLuxuryPerfumeEmailHtml(params: {
  subject: string;
  campaignCopy: string;
  imageUrl: string;
}): string {
  const { subject, campaignCopy, imageUrl } = params;
  const paragraphs = copyToParagraphs(campaignCopy);
  const safeImageUrl = escapeHtml(imageUrl.trim());
  const safeSubject = escapeHtml(subject.trim());

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
        background: #f7f1ea;
      }

      @media only screen and (max-width: 640px) {
        .email-shell {
          width: 100% !important;
          border-radius: 0 !important;
        }

        .section-padding {
          padding: 24px 18px !important;
        }

        .hero-title {
          font-size: 30px !important;
          line-height: 1.2 !important;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f7f1ea; padding:28px 12px;">
      <tr>
        <td align="center">
          <table class="email-shell" role="presentation" cellpadding="0" cellspacing="0" width="620" style="width:620px; max-width:620px; background:#fffaf4; border-radius:20px; overflow:hidden; border:1px solid #eadbc7;">
            <tr>
              <td class="section-padding" style="padding:28px 36px; background:linear-gradient(135deg,#1d120d 0%,#3b2419 55%,#6a4530 100%);">
                <p style="margin:0 0 12px; color:#e9d4b5; letter-spacing:2.6px; font-size:12px; font-family:Georgia, 'Times New Roman', serif; text-transform:uppercase;">Aurea Fragrance House</p>
                <h1 class="hero-title" style="margin:0; color:#f8ede0; font-size:40px; line-height:1.1; font-family:Georgia, 'Times New Roman', serif; font-weight:600;">A New Signature Scent Moment</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0; background:#f2e2cf;">
                <img src="${safeImageUrl}" alt="Luxury perfume visual" width="620" style="display:block; width:100%; max-width:620px; height:auto; border:0;" />
              </td>
            </tr>
            <tr>
              <td class="section-padding" style="padding:34px 36px 12px;">
                <h2 style="margin:0 0 16px; color:#24170f; font-size:24px; line-height:1.35; font-family:Georgia, 'Times New Roman', serif; font-weight:600;">${safeSubject}</h2>
                ${paragraphs}
              </td>
            </tr>
            <tr>
              <td class="section-padding" style="padding:8px 36px 34px;">
                <a href="#" style="display:inline-block; padding:14px 24px; border-radius:999px; background:#2a1a10; color:#f9e9d3; text-decoration:none; font-size:13px; letter-spacing:1.4px; text-transform:uppercase; font-family:Arial, Helvetica, sans-serif;">Discover The Collection</a>
                <p style="margin:18px 0 0; color:#7a5c47; font-size:12px; line-height:1.6; font-family:Arial, Helvetica, sans-serif;">You are receiving this because you are part of our private fragrance circle.</p>
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
  const html = buildLuxuryPerfumeEmailHtml({
    subject: payload.subject,
    campaignCopy: payload.campaignCopy,
    imageUrl: payload.imageUrl,
  });

  const accepted = new Set<string>();
  const rejected = new Set<string>();
  const messageIds: string[] = [];

  for (const recipientEmail of payload.recipientEmails) {
    const info = await transporter.sendMail({
      from: `"${sanitizedFromName}" <${fromAddress}>`,
      to: recipientEmail,
      subject: payload.subject,
      text: payload.campaignCopy,
      html,
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
