// lib/email/html-layout.ts
// Professional HTML email layout wrapper for cold outreach.
// Builds an email-client-safe HTML structure with inline CSS.
// Used by both TemplatePreview (live preview) and send.ts (actual sending).

export interface EmailDesign {
  logoUrl?: string
  websiteUrl?: string
  ctaText?: string
  footerText?: string
  accentColor?: string
}

const DEFAULT_DESIGN: Required<EmailDesign> = {
  logoUrl: '',
  websiteUrl: 'https://naszmarketplace.pl',
  ctaText: 'Dowiedz się więcej',
  footerText: 'Nasz Marketplace — 0% prowizji dla twórców handmade',
  accentColor: '#6366f1',
}

/**
 * Wraps plain-text email content in a professional HTML email layout.
 * All styles are inlined for maximum email client compatibility.
 *
 * The body text is treated as pre-formatted: newlines become <br>,
 * and any existing HTML tags are preserved.
 */
export function buildHtmlEmail(
  bodyText: string,
  design: EmailDesign = {}
): string {
  const d = { ...DEFAULT_DESIGN, ...design }

  // Convert plain text newlines to <br> if body doesn't already contain HTML block elements
  const hasHtmlBlocks = /<(div|p|table|h[1-6]|ul|ol)\b/i.test(bodyText)
  const htmlBody = hasHtmlBlocks ? bodyText : bodyText.replace(/\n/g, '<br>')

  const logoSection = d.logoUrl
    ? `<tr>
        <td style="padding: 32px 40px 16px; text-align: center;">
          <img src="${escapeHtml(d.logoUrl)}" alt="Logo" style="max-width: 180px; max-height: 60px; display: inline-block;" />
        </td>
      </tr>`
    : ''

  const ctaSection = d.websiteUrl && d.ctaText
    ? `<tr>
        <td style="padding: 24px 40px 8px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
            <tr>
              <td style="border-radius: 8px; background-color: ${escapeHtml(d.accentColor)};">
                <a href="${escapeHtml(d.websiteUrl)}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                  ${escapeHtml(d.ctaText)}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Email</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f7;">
    <tr>
      <td style="padding: 32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">

          ${logoSection}

          <!-- Body content -->
          <tr>
            <td style="padding: ${d.logoUrl ? '16px' : '40px'} 40px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.7; color: #374151;">
              ${htmlBody}
            </td>
          </tr>

          ${ctaSection}

          <!-- Divider -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: #9ca3af; text-align: center;">
              ${escapeHtml(d.footerText)}
              <br>
              <!--TRACKING_PIXEL-->
              <!--UNSUBSCRIBE_LINK-->
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
