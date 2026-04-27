import { getSupabase } from './_supabase.js'
import { withErrorHandling } from './_handler.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function parseSettingValue(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

export const handler = withErrorHandling(async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')

  if (error) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    }
  }

  const settings = {}
  for (const row of data || []) {
    settings[row.key] = parseSettingValue(row.value)
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  }
})
