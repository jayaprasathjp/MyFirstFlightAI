// Phone numbers: Indian mobiles must have exactly 10 digits (starting 6-9); typed without a country code they are
// taken as Indian and get +91. Numbers with another country code (family abroad) need 8-15 digits in all (E.164).
// Returns the number written as +91 98765 43210 / +6581234567, or null if it is not a valid number.
// Keep in step with normalize_phone in backend/schemas.py.
// testNumbers: also accept Firebase test numbers such as +91 1234567890 (sign-in, only in Firebase test mode).
export function normalizePhone(raw, { testNumbers = false } = {}) {
  const s = (raw || '').replace(/[\s().-]/g, '')
  const india = (testNumbers ? /^(?:\+?91|0)?(\d{10})$/ : /^(?:\+?91|0)?([6-9]\d{9})$/).exec(s)
  if (india) return `+91 ${india[1].slice(0, 5)} ${india[1].slice(5)}`
  if (/^\+?91/.test(s) || /^\d+$/.test(s)) return null // Indian, or no country code, but not 10 digits
  const other = /^\+(\d{8,15})$/.exec(s)
  return other ? `+${other[1]}` : null
}
