#!/usr/bin/env bash
# =====================================================================
# scripts/deploy.sh — Un solo comando para publicar todos los cambios:
#
#   1) Sube el código a GitHub (git add + commit + push)
#   2) Aplica las migraciones de base de datos nuevas en Supabase
#   3) Redespliega todas las Edge Functions en Supabase
#
# Render NO necesita un paso propio: como está conectado a tu repo de
# GitHub con Auto-Deploy activado, el push del paso 1 ya le dispara un
# deploy solo (ver la sección "Render" más abajo si además querés
# forzarlo manualmente).
#
# Uso:
#   ./scripts/deploy.sh "mensaje del commit"
#   ./scripts/deploy.sh                        (usa un mensaje con la fecha)
#
# Requisito de una sola vez antes de usar este script — ver SETUP.md,
# sección "Parte 7 — Deploy automático con scripts/deploy.sh".
# =====================================================================

set -uo pipefail

# Colores para que se lea más fácil en la terminal.
GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}==>${NC} $1"; }
warn()  { echo -e "${YELLOW}!!${NC} $1"; }
fail()  { echo -e "${RED}xx${NC} $1"; }

# Nos aseguramos de correr desde la raíz del proyecto (donde está este
# script adentro de scripts/), sin importar desde dónde lo llamaste.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

COMMIT_MSG="${1:-Actualización $(date '+%Y-%m-%d %H:%M')}"

echo ""
echo "🎭  Deploy de Butaca"
echo "===================="
echo ""

# ---------------------------------------------------------------------
# 1) GitHub
# ---------------------------------------------------------------------
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
  fail "Esta carpeta no es un repositorio git. Corré esto desde la carpeta del proyecto."
  exit 1
fi

info "Revisando cambios locales…"
git add -A

if ! git diff --cached --quiet; then
  info "Subiendo cambios a GitHub: \"$COMMIT_MSG\""
  git commit -m "$COMMIT_MSG"
else
  info "No hay cambios nuevos para commitear (puede que ya estén commiteados)."
fi

if git push; then
  info "Push a GitHub OK. Render va a detectar el cambio y desplegar solo en unos minutos."
else
  fail "El push a GitHub falló — revisá el mensaje de arriba (¿credenciales vencidas? ver el Personal Access Token en SETUP.md)."
  echo ""
  warn "Sigo igual con los pasos de Supabase, por si el problema fue solo de GitHub."
fi

echo ""

# ---------------------------------------------------------------------
# 2) Supabase — migraciones + Edge Functions
# ---------------------------------------------------------------------
if ! command -v supabase &> /dev/null; then
  warn "No encontré la Supabase CLI instalada — salteo este paso."
  warn "Instalala con: npm install -g supabase   (y después: supabase login && supabase link --project-ref TU-PROJECT-REF)"
else
  info "Aplicando migraciones nuevas en Supabase (supabase db push)…"
  if supabase db push; then
    info "Migraciones OK."
  else
    fail "supabase db push falló."
    warn "Si es la PRIMERA vez que usás este script, probablemente te falta el paso"
    warn "de 'bautizar' las migraciones que ya corriste a mano por el SQL Editor."
    warn "Ver SETUP.md, sección \"Parte 7\", antes de reintentar."
  fi

  echo ""
  info "Redesplegando Edge Functions…"
  for fn_dir in supabase/functions/*/; do
    fn_name="$(basename "$fn_dir")"
    [[ "$fn_name" == "_shared" ]] && continue
    echo "   -> $fn_name"
    supabase functions deploy "$fn_name" || fail "   no se pudo desplegar $fn_name (revisá el error de arriba)"
  done
  info "Edge Functions OK."
fi

echo ""

# ---------------------------------------------------------------------
# 3) Render — deploy automático por el push (opcional: forzarlo a mano)
# ---------------------------------------------------------------------
# Si preferís además disparar un deploy manual (no hace falta si el
# Auto-Deploy de Render está activado, que es lo normal), pegá tu
# Deploy Hook acá o como variable de entorno RENDER_DEPLOY_HOOK
# (Render > tu Static Site > Settings > Deploy Hook):
if [[ -n "${RENDER_DEPLOY_HOOK:-}" ]]; then
  info "Disparando deploy manual en Render…"
  if curl -fsS -X POST "$RENDER_DEPLOY_HOOK" > /dev/null; then
    info "Deploy de Render disparado."
  else
    fail "No se pudo disparar el deploy hook de Render."
  fi
else
  info "Render se despliega solo a partir del push a GitHub (Auto-Deploy). Nada más que hacer acá."
fi

echo ""
echo "✅  Listo."
