export const onRequestPost: PagesFunction<{
  OPENAI_API_KEY: string
}> = async (context) => {
  const { request, env } = context
  try {
    const apiKey = env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }

    const payload = await request.json<any>()
    const model = payload?.model || 'gpt-4o-mini'
    const messages = payload?.messages
    const response_format = payload?.response_format
    const temperature = typeof payload?.temperature === 'number' ? payload.temperature : 0.3

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, response_format, temperature }),
    })

    const text = await resp.text()
    return new Response(text, {
      status: resp.status,
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}


