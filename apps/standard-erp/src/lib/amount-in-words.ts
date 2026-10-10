const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`.trim()
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (h && rest) return `${ONES[h]} Hundred ${twoDigits(rest)}`
  if (h) return `${ONES[h]} Hundred`
  return twoDigits(rest)
}

/** Indian numbering: crore / lakh / thousand */
export function amountInWordsInr(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '—'
  const rounded = Math.round(amount * 100) / 100
  const whole = Math.floor(rounded)
  const paise = Math.round((rounded - whole) * 100)

  if (whole === 0 && paise === 0) return 'Zero Rupees Only'

  const crore = Math.floor(whole / 1_00_00_000)
  const lakh = Math.floor((whole % 1_00_00_000) / 1_00_000)
  const thousand = Math.floor((whole % 1_00_000) / 1000)
  const hundred = whole % 1000

  const parts: string[] = []
  if (crore) parts.push(`${threeDigits(crore)} Crore`)
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`)
  if (hundred) parts.push(threeDigits(hundred))

  let out = parts.join(' ').replace(/\s+/g, ' ').trim()
  out = `${out} Rupees`
  if (paise) out += ` and ${twoDigits(paise)} Paise`
  return `${out} Only`
}
