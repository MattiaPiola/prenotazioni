import { getSupabase } from './_supabase.js'

/**
 * Send a plain-text message to a Telegram chat via the Bot API.
 * Throws on network or API errors (caller must handle).
 */
export async function sendTelegramMessage(text, chatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.warn('[notify] TELEGRAM_BOT_TOKEN not set, skipping notification')
    return
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) {
    let description = `status ${res.status}`
    try {
      const errBody = await res.json()
      description = errBody.description || description
    } catch (_) {}
    throw new Error(`Telegram API error: ${description}`)
  }
}

/**
 * Emit a notification event. Fetches matching notification_rules from the DB,
 * filters by scope, formats a message, and sends it to the configured chat IDs.
 *
 * All errors are caught and logged; this function never throws.
 *
 * @param {string} eventType  - e.g. 'booking_created'
 * @param {{ room_id?: string, payload?: object }} options
 *   payload may include: room_slot_id, date, start_date, end_date,
 *                        teacher_name, class_name
 */
export async function emitEvent(eventType, { room_id, payload = {} } = {}) {
  try {
    const supabase = getSupabase()

    const { data: rules, error } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('enabled', true)
      .eq('event_type', eventType)

    if (error) {
      console.error('[notify] Error fetching notification rules:', error.message)
      return
    }
    if (!rules || rules.length === 0) return

    // Filter rules by scope
    const matched = rules.filter((r) => {
      if (r.scope === 'all_rooms') return true
      if (r.scope === 'specific_rooms') {
        return room_id && Array.isArray(r.room_ids) && r.room_ids.includes(room_id)
      }
      return false
    })
    if (matched.length === 0) return

    // Enrich payload with human-readable names when not already present
    let { room_name, slot_label } = payload
    if (!room_name && room_id) {
      const { data: room } = await supabase
        .from('rooms')
        .select('name')
        .eq('id', room_id)
        .single()
      room_name = room?.name || room_id
    }
    if (!slot_label && payload.room_slot_id) {
      const { data: slot } = await supabase
        .from('room_slots')
        .select('label, start_time, end_time')
        .eq('id', payload.room_slot_id)
        .single()
      if (slot) {
        slot_label = slot.label || `${slot.start_time}–${slot.end_time}`
      }
    }

    const text = buildMessage(eventType, { ...payload, room_name, slot_label })

    for (const rule of matched) {
      try {
        await sendTelegramMessage(text, rule.telegram_chat_id)
      } catch (err) {
        console.error(`[notify] Failed to send to chat ${rule.telegram_chat_id}:`, err.message)
      }
    }
  } catch (err) {
    console.error('[notify] emitEvent error:', err.message)
  }
}

function buildMessage(eventType, payload = {}) {
  const { room_name, slot_label, date, start_date, end_date, teacher_name, class_name } = payload

  const lines = []

  switch (eventType) {
    case 'booking_created':
      lines.push('📅 Nuova prenotazione')
      break
    case 'recurring_request_created':
      lines.push('🔄 Nuova richiesta ricorrente')
      break
    case 'recurring_request_approved':
      lines.push('✅ Richiesta ricorrente approvata')
      break
    case 'recurring_request_denied':
      lines.push('❌ Richiesta ricorrente negata')
      break
    case 'booking_cancelled':
      lines.push('🚫 Prenotazione cancellata')
      break
    default:
      lines.push(`Evento: ${eventType}`)
  }

  if (room_name) lines.push(`Aula: ${room_name}`)
  if (date) lines.push(`Data: ${date}`)
  if (start_date && end_date) lines.push(`Periodo: ${start_date} – ${end_date}`)
  if (slot_label) lines.push(`Orario: ${slot_label}`)
  if (teacher_name) lines.push(`Insegnante: ${teacher_name}`)
  if (class_name) lines.push(`Classe: ${class_name}`)

  return lines.join('\n')
}
