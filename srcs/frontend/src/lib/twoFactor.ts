import QRCode from 'qrcode'

// the backend tolerates spaces in a TOTP and case/dashes in a recovery code
export const TOTP_PATTERN = /^\d{3}\s?\d{3}$/
export const RECOVERY_PATTERN = /^[a-z0-9]{4}-?[a-z0-9]{4}-?[a-z0-9]{4}$/i
// fields that accept either (2FA-gated changes, turning 2FA off)
export const TOTP_OR_RECOVERY = new RegExp(`${TOTP_PATTERN.source}|${RECOVERY_PATTERN.source}`, 'i')

// otpauth:// URI -> SVG QR as a data URI (CSP img-src allows data:)
export async function qrDataUri(otpauthUri: string): Promise<string> {
  const svg = await QRCode.toString(otpauthUri, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// "JBSWY3DPEHPK3PXP" -> "JBSW Y3DP EHPK 3PXP": easier to type by hand
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ')
}
