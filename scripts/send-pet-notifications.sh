#!/usr/bin/env bash
# 手动触发宠物通知调度函数（send-pet-notifications），打印各家庭 results。
# 在 docker 所在机（远程 workspace）跑：  scripts/send-pet-notifications.sh
# 可选环境变量：API_URL（默认 http://localhost:8000，即本机 Kong 网关）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../supabase-docker/.env"

ANON_KEY=$(grep '^ANON_KEY=' "$ENV_FILE" | cut -d= -f2-)
API_URL="${API_URL:-http://localhost:8000}"

echo "POST $API_URL/functions/v1/send-pet-notifications"
RESP=$(curl -s -X POST "$API_URL/functions/v1/send-pet-notifications" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

# 美化输出；没有 python3 时回退到原始 JSON
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
