import { requireAdmin } from './_auth.js'
import { getSupabase } from './_supabase.js'
import { withErrorHandling } from './_handler.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
}

export const handler = withErrorHandling(async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS }
  }

  let ctx
  try {
    ctx = requireAdmin(event)
  } catch (err) {
    return {
      statusCode: err.status || 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }

  let name = null
  if (!ctx.is_superadmin && ctx.admin_user_id) {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('admin_users')
      .select('name')
      .eq('id', ctx.admin_user_id)
      .single()
    name = data?.name || null
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      is_superadmin: ctx.is_superadmin,
      admin_user_id: ctx.admin_user_id,
      name,
    }),
  }
})
