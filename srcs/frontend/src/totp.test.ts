import { expect, test } from 'vitest'
import { groupSecret, qrDataUri } from './totp'

test('groupSecret splits the key into groups of four', () => {
  expect(groupSecret('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')
  expect(groupSecret('ABCDE')).toBe('ABCD E')
})

test('qrDataUri renders an SVG data URI (CSP allows img-src data:)', async () => {
  const uri = await qrDataUri('otpauth://totp/SmartBreeds:a%40b.co?secret=JBSWY3DPEHPK3PXP&issuer=SmartBreeds')
  expect(uri.startsWith('data:image/svg+xml,')).toBe(true)
  expect(decodeURIComponent(uri.slice('data:image/svg+xml,'.length))).toContain('<svg')
})
