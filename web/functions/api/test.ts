export const onRequestGet = async () => {
  return new Response(JSON.stringify({ message: 'Test function working!', timestamp: new Date().toISOString() }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

