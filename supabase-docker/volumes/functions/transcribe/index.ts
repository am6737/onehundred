const ASR_PROVIDER = Deno.env.get('ASR_PROVIDER') || 'openai'
const ASR_API_KEY = Deno.env.get('ASR_API_KEY') || ''
const ASR_MODEL = Deno.env.get('ASR_MODEL') || ''
const ASR_BASE_URL = Deno.env.get('ASR_BASE_URL') || ''

async function transcribeWithOpenAI(
  audio: Uint8Array,
  ext: string,
  language?: string,
): Promise<string> {
  const model = ASR_MODEL || 'whisper-1'
  const baseUrl = ASR_BASE_URL || 'https://api.openai.com/v1'
  const form = new FormData()
  form.append('file', new Blob([audio]), `audio.${ext}`)
  form.append('model', model)
  if (language) form.append('language', language)

  const headers: Record<string, string> = {}
  if (ASR_API_KEY) headers['Authorization'] = `Bearer ${ASR_API_KEY}`

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers,
    body: form,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ASR API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.text
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'authorization, content-type, x-audio-ext, x-language',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!ASR_API_KEY && !ASR_BASE_URL) {
    return new Response(
      JSON.stringify({ error: 'ASR_API_KEY or ASR_BASE_URL must be configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const ext = req.headers.get('x-audio-ext') || 'm4a'
    const language = req.headers.get('x-language') || undefined
    const audio = new Uint8Array(await req.arrayBuffer())

    if (!audio.length) {
      return new Response(JSON.stringify({ error: 'Empty audio body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let transcript: string

    switch (ASR_PROVIDER) {
      case 'openai':
      default:
        transcript = await transcribeWithOpenAI(audio, ext, language)
        break
    }

    return new Response(JSON.stringify({ transcript }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Transcription error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
