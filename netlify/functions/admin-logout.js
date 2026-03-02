import { clearSessionCookie } from './_auth.js'
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

  const cookie = clearSessionCookie()

  return {
    statusCode: 200,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
    body: JSON.stringify({ ok: true }),
  }
})
