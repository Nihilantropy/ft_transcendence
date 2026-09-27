import QRCode from 'qrcode'

/** otpauth:// URI → an <img>-ready SVG data URI. Rendered in the browser: the secret never leaves it. */
export async function qrDataUri(uri: string): Promise<string> {
  const svg = await QRCode.toString(uri, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP": the accessible alternative to the QR, typed by hand. */
export const groupSecret = (secret: string) => secret.replace(/(.{4})(?=.)/g, '$1 ')

/** Save text as a file from the browser (a Blob, no server round-trip). */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
