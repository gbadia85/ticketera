// Edge Function: release-expired-holds
//
// Alternativa a pg_cron: si tu plan de Supabase no permite habilitar
// pg_cron, invocá esta función cada 1 minuto desde un cron externo
// gratuito (ej. cron-job.org o GitHub Actions) apuntando a:
//   https://TU-PROYECTO.supabase.co/functions/v1/release-expired-holds
// con el header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY o ANON_KEY>

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, getServiceRoleKey } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      getServiceRoleKey()
    );

    const { data, error } = await supabase.rpc('release_expired_holds');
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ ok: true, released: data });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
