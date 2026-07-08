export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Devuelve la clave con privilegios de servidor (bypassea RLS) sin importar
 * si tu proyecto de Supabase todavía usa el sistema clásico de claves
 * (service_role, un JWT) o el sistema nuevo (secret keys, sb_secret_...).
 * Desde noviembre de 2025 los proyectos NUEVOS de Supabase ya no tienen
 * anon/service_role: solo Publishable key y Secret keys. Ambos casos
 * quedan cubiertos acá para que este código funcione en cualquiera.
 */
export function getServiceRoleKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  const secretsJson = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretsJson) {
    try {
      const parsed = JSON.parse(secretsJson);
      const firstKey = parsed.default ?? Object.values(parsed)[0];
      if (firstKey) return firstKey as string;
    } catch (_err) {
      // sigue al error de abajo
    }
  }

  throw new Error(
    'No se encontró una service_role key ni una secret key en las variables de entorno de esta función. ' +
      'Revisá Supabase Dashboard > Edge Functions > Secrets (ver SETUP.md, sección "Claves de API").'
  );
}
