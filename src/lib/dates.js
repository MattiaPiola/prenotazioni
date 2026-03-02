export const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

const SHORT_DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

/**
 * Returns array of 7 Date objects (Mon–Sun) for the week at the given offset.
 * weekOffset=0 → current week, weekOffset=1 → next week.
 */
export function getWeekDates(weekOffset = 0) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // day of week: 0=Sun,1=Mon,...,6=Sat → convert to Mon=0
  const dow = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - dow + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

/**
 * Returns YYYY-MM-DD string for a Date object.
 */
export function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns display string like "Lun 3 Mar"
 */
export function formatDisplayDate(date) {
  const dow = (date.getDay() + 6) % 7
  return `${SHORT_DAY_NAMES[dow]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`
}

/**
 * Returns true if date falls within current week (Mon) to next week (Sun).
 */
export function isCurrentOrNextWeek(date) {
  const current = getWeekDates(0)
  const next = getWeekDates(1)
  const from = current[0]
  const to = next[6]
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
  d.setHours(0, 0, 0, 0)
  return d >= from && d <= to
}
