import { File as FSFile } from 'expo-file-system';
import { supabase } from './supabase';

export async function transcribeAudio(uri: string): Promise<string> {
  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'm4a';
  const bytes = await new FSFile(uri).bytes();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;

  const res = await fetch(`${supabaseUrl}/functions/v1/transcribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/octet-stream',
      'x-audio-ext': ext,
    },
    body: bytes,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Transcription failed: ${res.status}`);
  }

  const data = await res.json();
  return data.transcript;
}
