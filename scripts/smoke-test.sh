#!/bin/bash
#
# Smoke test against a RUNNING server — the checks that only mean something once
# the real app, the real database and the real exchange are in play. Everything
# that can be proven in isolation lives in the unit and e2e suites instead.
#
#   API_URL=http://localhost:3000/api ./scripts/smoke-test.sh
#
API="${API_URL:-http://localhost:3100/api}"
PASS=0; FAIL=0
check() { # name expected actual
  if [ "$2" == "$3" ]; then echo "  ✓ $1"; PASS=$((PASS+1));
  else echo "  ✗ $1 (expected $2, got $3)"; FAIL=$((FAIL+1)); fi
}
code() { curl -s -o /tmp/body.json -w "%{http_code}" "$@"; }

EMAIL="smoke-$(date +%s)@example.com"
EMAIL2="smoke2-$(date +%s)@example.com"

echo "── 1. Đăng ký & đăng nhập ──"
check "register mật khẩu yếu bị chặn" 400 "$(code -X POST $API/auth/register -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"123\"}")"
check "register hợp lệ" 201 "$(code -X POST $API/auth/register -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"CorrectHorse123\"}")"
TOKEN=$(python3 -c "import json;print(json.load(open('/tmp/body.json'))['accessToken'])")
REFRESH=$(python3 -c "import json;print(json.load(open('/tmp/body.json'))['refreshToken'])")
check "register trùng email" 409 "$(code -X POST $API/auth/register -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"CorrectHorse123\"}")"
check "login đúng mật khẩu" 201 "$(code -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"CorrectHorse123\"}")"
check "login sai mật khẩu" 401 "$(code -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPass1234\"}")"
check "gửi field lạ (role=ADMIN) bị chặn" 400 "$(code -X POST $API/auth/register -H 'Content-Type: application/json' -d "{\"email\":\"x$EMAIL\",\"password\":\"CorrectHorse123\",\"role\":\"ADMIN\"}")"

echo "── 2. Token ──"
check "GET /me không token" 401 "$(code $API/auth/me)"
check "GET /me token rác" 401 "$(code $API/auth/me -H 'Authorization: Bearer garbage')"
check "GET /me hợp lệ" 200 "$(code $API/auth/me -H "Authorization: Bearer $TOKEN")"
ROLE=$(python3 -c "import json;print(json.load(open('/tmp/body.json'))['role'])")
check "role mặc định là USER" "USER" "$ROLE"
check "refresh hợp lệ" 201 "$(code -X POST $API/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}")"
check "refresh token cũ (replay) bị từ chối" 401 "$(code -X POST $API/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}")"

echo "── 3. Catalog chiến lược ──"
check "cần đăng nhập mới xem được" 401 "$(code $API/strategies)"
check "lấy catalog" 200 "$(code $API/strategies -H "Authorization: Bearer $TOKEN")"
COUNT=$(python3 -c "import json;print(len(json.load(open('/tmp/body.json'))))")
check "số chiến lược" 8 "$COUNT"
python3 - <<'PY'
import json
data = json.load(open('/tmp/body.json'))
print("  → " + ", ".join(f"{s['key']}({len(s['params'])} tham số)" for s in data))
PY
check "chi tiết rsi-reversal" 200 "$(code $API/strategies/rsi-reversal -H "Authorization: Bearer $TOKEN")"
check "chiến lược không tồn tại" 404 "$(code $API/strategies/khong-co -H "Authorization: Bearer $TOKEN")"

echo "── 4. API key sàn ──"
check "list rỗng ban đầu" 200 "$(code $API/exchange-accounts -H "Authorization: Bearer $TOKEN")"
check "key giả bị Binance từ chối" 422 "$(code -X POST $API/exchange-accounts -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"exchange":"BINANCE","label":"test","apiKey":"AAAAAAAAAAAAAAAAAAAAAAAA","apiSecret":"SSSSSSSSSSSSSSSSSSSSSSSS"}')"
python3 -c "import json;print('  → lý do:', json.load(open('/tmp/body.json'))['message'][:90])"
check "sàn không hỗ trợ bị chặn" 400 "$(code -X POST $API/exchange-accounts -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"exchange":"FTX","label":"x","apiKey":"AAAAAAAAAAAAAAAAAAAAAAAA","apiSecret":"SSSSSSSSSSSSSSSSSSSSSSSS"}')"
check "key quá ngắn bị chặn" 400 "$(code -X POST $API/exchange-accounts -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"exchange":"BINANCE","label":"x","apiKey":"short","apiSecret":"short"}')"

echo "── 5. Cách ly giữa các user ──"
code -X POST $API/auth/register -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL2\",\"password\":\"CorrectHorse123\"}" > /dev/null
TOKEN2=$(python3 -c "import json;print(json.load(open('/tmp/body.json'))['accessToken'])")
check "user B không thấy tài nguyên user A" 200 "$(code $API/bots -H "Authorization: Bearer $TOKEN2")"
LEN=$(python3 -c "import json;print(len(json.load(open('/tmp/body.json'))))")
check "danh sách bot của B rỗng" 0 "$LEN"
check "truy cập bot lạ trả 404 (không phải 403)" 404 "$(code -X POST $API/bots/00000000-0000-0000-0000-000000000000/start -H "Authorization: Bearer $TOKEN2")"
check "truy cập order lạ trả 404" 404 "$(code -X DELETE $API/orders/00000000-0000-0000-0000-000000000000 -H "Authorization: Bearer $TOKEN2")"

echo "── 6. Hạ tầng ──"
check "liveness" 200 "$(code $API/health)"
check "readiness" 200 "$(code $API/health/ready)"
check "route không tồn tại" 404 "$(code $API/khong-ton-tai)"
HDRS=$(curl -s -D - -o /dev/null $API/health)
for h in "x-content-type-options" "x-frame-options" "strict-transport-security"; do
  echo "$HDRS" | grep -qi "^$h" && { echo "  ✓ header $h"; PASS=$((PASS+1)); } || { echo "  ✗ thiếu header $h"; FAIL=$((FAIL+1)); }
done
CORS=$(curl -s -D - -o /dev/null -H "Origin: http://evil.com" $API/health | grep -i "access-control-allow-origin")
[ -z "$CORS" ] && { echo "  ✓ CORS chặn origin lạ"; PASS=$((PASS+1)); } || { echo "  ✗ CORS cho phép evil.com"; FAIL=$((FAIL+1)); }

echo "── 7. Rate limit ──"
LIMITED=0
for i in $(seq 1 15); do
  C=$(code -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"brute@x.com","password":"Guess1234567"}')
  [ "$C" == "429" ] && LIMITED=1
done
[ "$LIMITED" == "1" ] && { echo "  ✓ brute-force login bị chặn (429)"; PASS=$((PASS+1)); } || { echo "  ✗ không bị rate limit"; FAIL=$((FAIL+1)); }

echo
echo "══════ KẾT QUẢ: $PASS pass, $FAIL fail ══════"
exit $FAIL
