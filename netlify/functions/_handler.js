const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
}

export function withErrorHandling(fn) {
  return async (event, context) => {
    try {
      return await fn(event, context)
    } catch (err) {
      console.error('Unhandled function error:', err)
      return {
        statusCode: err.status || 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message || 'Internal server error' }),
      }
    }
  }
}
