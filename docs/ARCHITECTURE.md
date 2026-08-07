# Dokabot SaaS — Audit & Re-design (target: 1M users, Binance + Bybit)

## 0. TL;DR

Codebase hiện tại là **personal single-tenant bot**: 1 process NestJS, 1 API key trong `.env`,
password hardcode, chiến lược khởi động trong `bootstrap()`, state trong biến instance.
Không có khái niệm user/tenant. Để thành SaaS 1 triệu user, đây không phải là refactor —
là **re-platform**: giữ lại phần giá trị nhất (strategy engine + indicators), viết lại phần còn lại.

---

## 1. AUDIT — hiện trạng

### 1.1 Blocker bảo mật (P0 — phải sửa trước mọi thứ)

| # | Vấn đề | File | Rủi ro |
|---|--------|------|--------|
| S1 | Password admin hardcode `'Aa111111'` | `be/src/modules/authentication/authentication.service.ts:15` | Toàn quyền hệ thống |
| S2 | `JWT_SECRET="secret"`, TTL `100d` | `.env.example` | Forge token vĩnh viễn |
| S3 | API key sàn để plaintext trong env, dùng chung 1 key cho cả app | `binance.service.ts` | Mất key = mất toàn bộ vốn |
| S4 | Không có RBAC, không tenant scoping — mọi query Prisma đều global | toàn bộ modules | IDOR toàn diện khi thêm user |
| S5 | Không rate limit, không CSRF/CORS whitelist (`cors: true`) | `main.ts:8` | Abuse, credential stuffing |
| S6 | Không audit log cho hành vi tiền bạc | — | Không điều tra được sự cố |

### 1.2 Blocker kiến trúc (P0)

- **Stateful process**: `StrategyService` giữ `mini1..mini3`, `future`… trong field instance ⇒
  không thể chạy >1 replica, restart = mất state, không scale ngang.
- **Strategy chạy trong HTTP process**: `bootstrap()` gọi `startStrategy()` sau `app.listen()`.
  Một strategy loop chậm ⇒ API chết theo. Không tách được compute khỏi serving.
- **Không có message bus**: `EventEmitter2` là in-memory, chỉ sống trong 1 process.
- **Settings là bảng key/value global** (`Setting`), giá trị `String`, ~30 key hardcode trong enum.
  Không thể per-user, không type-safe, không versioning.
- **Model dữ liệu không có `userId`** ở bất kỳ bảng nào (`Position`, `SellSuccess`, `SidewayScenario`).
- **Float cho tiền**: `buyPrice Float`, `qty Float` trong Prisma ⇒ sai số tích lũy.
  (`decimal.js` đã có trong deps nhưng DB vẫn Float.)
- **MySQL đơn instance**, không partition, không time-series store cho candle/tick.
- Chỉ Binance. Không có abstraction sàn ⇒ thêm Bybit = copy-paste.
- Không có test (`jest` cấu hình nhưng 0 file `.spec.ts`), không CI, không Docker/IaC, không observability.

### 1.3 Cái đáng giữ

- `modules/strategy/strategies/*` (ICT, mini reversal DCA, futures EMA, gold RSI) và
  `helpers/` (volume-profile, indicators, regime-hmm) — đây là IP thật sự.
- Cấu trúc module NestJS + interface `IStrategy` là điểm bám tốt để trừu tượng hoá.

---

## 2. RE-DESIGN — kiến trúc mục tiêu

### 2.1 Nguyên tắc

1. **Tách 3 mặt phẳng**: Control plane (API/UI, CRUD, billing) — Data plane (market data) —
   Execution plane (strategy + order). Ba cái scale theo 3 trục khác nhau.
2. **Stateless services + state ngoài** (Postgres, Redis, Kafka). Mọi thứ restart-safe.
3. **Sharded execution**: bot được gán deterministically vào shard theo `hash(botId)`.
4. **Market data fan-out**: 1M user KHÔNG mở 1M websocket tới sàn. Một cụm ingester duy nhất
   subscribe sàn → publish vào Kafka → mọi worker consume. Đây là quyết định kiến trúc quan trọng nhất.
5. **Exchange-agnostic core**: strategy nói chuyện với `IExchangeAdapter`, không biết Binance/Bybit.

### 2.2 Sơ đồ hệ thống

```
                     Cloudflare (WAF, DDoS, CDN)
                              │
                    ┌─────────┴─────────┐
                    │   API Gateway     │  Kong/Envoy: authN, rate-limit theo tenant
                    └─────────┬─────────┘
        ┌──────────┬──────────┼──────────┬───────────┐
        │          │          │          │           │
   [auth-svc] [bot-svc] [portfolio-svc] [billing-svc] [notify-svc]
        │          │          │          │           │
        └──────────┴────┬─────┴──────────┴───────────┘
                        │
        ┌───────────────┴────────────────┐
        │  Postgres (Citus/RDS) + Redis  │
        │  TimescaleDB (candles/ticks)   │
        │  Vault/KMS (API key envelope)  │
        └───────────────┬────────────────┘
                        │
                    ┌───┴────┐
                    │ Kafka  │ topics: market.tick, market.kline, signal, order.cmd, order.fill, audit
                    └───┬────┘
        ┌───────────────┼─────────────────┐
        │               │                 │
[market-ingester]  [strategy-worker]  [execution-worker]
 (per exchange,     (shard 0..N,       (per-exchange rate-limited
  1 WS pool)         stateless)         order router + reconciler)
```

### 2.3 Thành phần

**market-ingester** (Go hoặc Node, 1 deployment / sàn)
- Duy trì pool websocket tới Binance/Bybit, subscribe theo union tất cả symbol đang được dùng.
- Normalize → `market.kline.{exchange}.{symbol}.{interval}` trên Kafka.
- Ghi TimescaleDB cho backtest/chart. Gap-fill qua REST khi WS reconnect.
- Chi phí không đổi theo số user ⇒ đây là cách duy nhất phục vụ 1M user.

**strategy-worker** (NestJS, N replicas)
- Consume kline theo partition = shard. Load bot config từ Postgres (cache Redis).
- Chạy `IStrategy.onCandle(ctx)`; state của bot lưu Redis hash + snapshot Postgres.
- Emit `signal` — KHÔNG tự đặt lệnh.

**execution-worker** (NestJS, per-exchange)
- Consume `order.cmd`, giải mã API key của user từ vault, đặt lệnh.
- Token bucket theo (exchange, apiKeyId) để không đụng weight limit của sàn.
- Idempotency: `clientOrderId = uuidv5(botId, signalId)`.
- Reconciler: định kỳ diff open orders / positions với sàn, phát `order.fill`.

**Cách ly rủi ro**: user free/paid chạy trên consumer group khác nhau; một tenant chạy chậm không
làm nghẽn tenant khác (bulkhead per shard + timeout cứng cho mỗi `onCandle`).

### 2.4 Quản lý API key (màn hình Bybit/Binance) — thiết kế bảo mật

```
User nhập key/secret trên FE (HTTPS)
   → api gateway → key-vault-svc
   → envelope encryption: DEK ngẫu nhiên/khoá, AES-256-GCM;
     DEK được wrap bằng KMS master key (AWS KMS / HashiCorp Vault Transit)
   → DB lưu: ciphertext, iv, authTag, wrappedDek, keyId, kmsKeyVersion
```

Quy tắc bắt buộc:
- **Secret không bao giờ trả về client**. FE chỉ thấy `label`, `exchange`, 4 ký tự cuối, permissions, IP allowlist, trạng thái.
- **Validate ngay khi thêm**: gọi API sàn kiểm tra key sống, đọc permissions.
  **Từ chối key có quyền Withdraw** — đây là hard rule.
- **Bắt buộc IP allowlist** phía sàn: hiển thị dải IP static egress (NAT gateway) của execution-worker.
- Decrypt chỉ xảy ra trong execution-worker, in-memory, TTL cache ≤ 5 phút, không log.
- Audit log mọi lần dùng key: `apiKeyId, botId, action, ip, ts`.
- Hỗ trợ rotate + revoke tức thì (publish `key.revoked` → worker drop cache).
- Sub-account / testnet flag riêng biệt để user thử an toàn.

### 2.5 Data model (multi-tenant, Postgres)

Mọi bảng nghiệp vụ có `user_id` + **Row Level Security** bật ở Postgres (defense in depth,
không phụ thuộc vào việc dev nhớ thêm `where`).

```
users(id, email, password_hash, mfa_secret, status, plan_id, created_at)
teams / team_members            -- optional B2B
exchange_accounts(id, user_id, exchange, label, key_ciphertext, iv, auth_tag,
                  wrapped_dek, kms_key_id, perms jsonb, last_verified_at, status)
bots(id, user_id, exchange_account_id, strategy_key, symbol, timeframe,
     config jsonb, status, shard_id, created_at)
bot_states(bot_id, state jsonb, updated_at)          -- snapshot, nguồn thật là Redis
positions(id, user_id, bot_id, symbol, side, entry_price NUMERIC(38,18),
          qty NUMERIC(38,18), ...)                    -- NUMERIC, không Float
orders(id, user_id, bot_id, client_order_id UNIQUE, exchange_order_id, status, ...)
trades(...)                                           -- partition theo tháng
subscriptions / invoices / usage_meters
audit_logs(...)                                       -- append-only, partition theo ngày
```

Sharding: bắt đầu bằng 1 Postgres primary + read replicas; khi `trades`/`orders` vượt ~500M dòng,
chuyển sang Citus phân tán theo `user_id` (chọn `user_id` làm distribution key ngay từ đầu để
migration là no-op về mặt schema).

### 2.6 Frontend

Nuxt 3 hiện tại giữ được, nhưng:
- Tách `apps/web` (marketing, SSR/SSG, SEO) và `apps/app` (dashboard, SPA) — khác nhau về cache strategy.
- i18n từ ngày đầu (global product), `@nuxtjs/i18n`, tiền tệ/timezone theo user.
- Realtime PnL qua **SSE hoặc WS gateway riêng** (không nhét vào API pod), fan-out qua Redis pub/sub.
- Charts: `lightweight-charts` (đã có) đọc từ TimescaleDB qua endpoint aggregate, không đọc trực tiếp sàn.
- Màn hình bắt buộc: Dashboard PnL, Bots (create/backtest/start/stop), **API Keys**, Positions/Orders,
  Backtest, Billing, Security (MFA, sessions, audit log), Referral.

### 2.7 Non-functional

| Hạng mục | Mục tiêu |
|---|---|
| API p99 | < 200ms (đọc), < 500ms (ghi) |
| Signal → order gửi sàn | < 250ms p95 |
| Uptime execution plane | 99.95% |
| RPO / RTO | 5 phút / 30 phút (PITR + multi-AZ) |
| Observability | OpenTelemetry traces, Prometheus, Loki; alert theo tenant |
| Compliance | SOC2-ready audit trail, GDPR export/delete, KYC nếu có custody (thiết kế non-custodial để tránh) |

**Non-custodial là quyết định pháp lý quan trọng**: không giữ tiền user, chỉ giữ API key
không có quyền rút. Điều này loại bỏ phần lớn gánh nặng license MSB/VASP.

---

## 3. LỘ TRÌNH

**Phase 0 — Stop the bleeding (1 tuần)**
Xoá password hardcode; JWT secret từ KMS, TTL 15m + refresh token; CORS whitelist; Helmet;
rate limit; gỡ API key khỏi env.

**Phase 1 — Multi-tenant foundation (3–4 tuần)**
Postgres + schema mới có `user_id` + RLS; auth thật (email+password+TOTP, OAuth);
key-vault-svc + màn hình API Keys (Binance + Bybit) đầy đủ validate/revoke.

**Phase 2 — Exchange abstraction (2–3 tuần)**
`IExchangeAdapter` (fetchOHLCV, placeOrder, cancel, positions, balances, ws streams);
adapter Binance (port từ code hiện tại) + adapter Bybit v5; contract test chung cho cả hai;
chạy paper-trading adapter mặc định.

**Phase 3 — Tách execution plane (4 tuần)**
Kafka; market-ingester; strategy-worker stateless + shard; execution-worker idempotent + reconciler.
Port 4 strategy hiện có vào interface mới.

**Phase 4 — SaaS (4 tuần)**
Billing (Stripe + crypto), plan/quota, referral, notification (Telegram/email/webhook), i18n, marketing site.

**Phase 5 — Scale & harden (liên tục)**
Backtest engine, chaos/failover drill, Citus khi cần, load test 1M user mô phỏng,
pentest + bug bounty.

**Ước lượng**: 4–6 kỹ sư, ~5–6 tháng tới GA.

---

## 4. Rủi ro lớn nhất

1. **Rate limit của sàn** — không phải CPU, mà weight limit của Binance/Bybit là trần thật sự.
   Giải pháp: gộp market data (đã có ở trên) + phân bổ order budget theo API key của user.
2. **Sự cố tài chính do bug** — bắt buộc: kill-switch toàn cục, per-bot max loss, dry-run mặc định,
   canary deploy theo shard.
3. **Bảo mật key** — một lần rò rỉ là chấm dứt sản phẩm. Xem 2.4, không thoả hiệp.

---

## 5. TRẠNG THÁI TRIỂN KHAI

### Phase 0 — Đã xong

- Bỏ password hardcode; auth thật bằng email + bcrypt (cost 12).
- Access token 15 phút + refresh token opaque 48 byte, chỉ lưu **hash SHA-256** trong DB,
  **rotate mỗi lần refresh**; phát hiện re-use ⇒ thu hồi toàn bộ session của user đó.
- `validateEnv()` chặn boot khi `JWT_SECRET` yếu/ngắn hoặc `KEY_VAULT_MASTER_KEY` sai độ dài.
- Helmet, CORS whitelist theo `CORS_ORIGINS`, global `ValidationPipe`
  (`whitelist` + `forbidNonWhitelisted`), throttler 120 req/phút (login 10, register 5).
- JWT strategy kiểm tra trạng thái user trong DB mỗi request ⇒ khoá tài khoản có hiệu lực ngay.
- Strategy runner single-tenant chuyển sang opt-in bằng `RUN_LEGACY_STRATEGIES=true`,
  không còn chạy mặc định trong process API.

### Phase 1 — Đã xong (phần nền)

- Schema multi-tenant: `users`, `refresh_tokens`, `exchange_accounts`, `audit_logs`;
  `user_id` (nullable, backfill ở Phase 2) trên `positions` / `sell_successes` / `sideway_scenarios`.
  Migration: `prisma/migrations/20260807000000_multi_tenant_foundation`.
- `KeyVaultService` — envelope encryption AES-256-GCM, DEK riêng mỗi bản ghi, DEK được wrap
  bằng master key. `wrapDek`/`unwrapDek` là điểm thay bằng AWS KMS / Vault Transit. 6 unit test.
- `IExchangeAdapter` + `BinanceAdapter` + `BybitAdapter` (REST thuần, không SDK) + `ExchangeRegistry`.
- Module `exchange-accounts`: list / create / update / verify / revoke.
  Verify key với sàn trước khi lưu, **từ chối key có quyền Withdraw**, từ chối key không trade được,
  cache credential giải mã 5 phút, revoke xoá sạch ciphertext, mọi thao tác ghi audit log.
- FE: màn hình `/api-keys` (thêm/kiểm tra/gỡ key Binance & Bybit), composable
  `useExchangeAccounts`, API base URL chuyển sang `runtimeConfig` (bỏ host hardcode).

### Phase 2 — Đã xong (exchange abstraction + execution an toàn)

- `IExchangeAdapter` đầy đủ: `fetchOHLCV`, `fetchSymbolInfo`, `fetchBalances`,
  `placeOrder`, `cancelOrder`, `fetchOrder`, `fetchOpenOrders`.
  Adapter **stateless** — credential truyền theo từng lời gọi, 1 instance phục vụ mọi tenant.
- Giá và khối lượng đi qua biên adapter dưới dạng **string** (`Numeric`), không phải `number`.
  IEEE-754 không giữ chính xác được số lượng 8 chữ số thập phân; sai số ở đây là lệnh sai size thật.
- `BinanceAdapter` + `BybitAdapter` viết REST thuần, có chuẩn hoá lỗi
  (`ExchangeError` / `ExchangeAuthError` / `ExchangeRateLimitError`) kèm cờ `retryable`.
- `RateLimiterService` — token bucket theo `(exchange, apiKey)`. Weight limit của sàn mới là trần
  thật sự của hệ thống (§4), không phải CPU. Phase 3 chuyển bucket này sang Redis dùng chung
  giữa các execution worker.
- Bảng `bots` + `orders`. Tiền dùng `DECIMAL(38,18)`.
  `bots.shard_id = hash(id) % STRATEGY_SHARD_COUNT` ⇒ worker tự quyết định bot nào thuộc về mình,
  không cần điều phối.
- **Idempotency**: `client_order_id` sinh xác định từ `(userId, idempotencyKey)`, có
  **UNIQUE index ở DB** — bảo đảm nằm ở database chứ không ở code. Retry sau timeout không mở lệnh thứ hai.
- **Ghi row trước khi gọi sàn**: nếu process chết giữa chừng, intent vẫn được ghi ở trạng thái
  `PENDING` để reconciler tra lại. Lỗi `retryable` giữ nguyên `PENDING`, lỗi vĩnh viễn mới `REJECTED`.
  Trường hợp không bao giờ được phép xảy ra: tiền đã chuyển mà không ai ghi lại.
- **Paper trading mặc định**: bot mới `isPaper = true`, chạy hết pipeline nhưng không chạm sàn.
- **Kill switch toàn cục**: `TRADING_KILL_SWITCH=true` chặn mọi lệnh mới.
- FK `bots.exchange_account_id` là `RESTRICT` — không thể xoá API key khi còn bot đang dùng;
  `orders.bot_id` là `SET NULL` — xoá bot không xoá lịch sử lệnh.

### Còn lại của Phase 1 (chưa làm)

- TOTP MFA, quên mật khẩu / xác thực email.
- Backfill `user_id` rồi siết `NOT NULL`; chuyển tiền từ `Float` sang `NUMERIC(38,18)`
  (đụng nhiều file strategy nên tách riêng).
- Chuyển MySQL → Postgres + RLS.
- Dải IP egress tĩnh cho execution worker (hiện là placeholder trên UI).

### Phase 2b — Đã xong (reconciler + risk guard + UI)

- `ReconcilerService` chạy mỗi 30 giây:
  - Quét lệnh `NEW` / `PARTIALLY_FILLED`, và lệnh `PENDING` cũ hơn 30 giây
    (PENDING lâu = bị đứt giữa chừng, không phải chậm), đối chiếu lại với sàn.
  - Giới hạn 200 lệnh mỗi tick: tồn đọng làm chậm chứ không làm sập.
  - Cờ `running` chặn hai tick chồng nhau — hai lượt cùng settle một lệnh là sai.
  - Một tài khoản không kết nối được không làm dừng cả batch.
- **Risk guard**: bot có `maxLossUsd` sẽ tự `STOPPED` khi lỗ thực tế vượt mức.
  Đây là lưới an toàn cho bug chiến lược — chiến lược nghĩ gì không quan trọng,
  nền tảng dừng nó khi lỗ thật vượt ngưỡng user đặt.
  PnL tính bằng `decimal.js`, cố tình bỏ qua vị thế đang mở để không phụ thuộc price feed.
- FE: màn hình `/bots` (tạo/chạy/tạm dừng/dừng/xoá, cảnh báo rõ khi bật tiền thật)
  và `/orders` (đồng bộ, huỷ, lọc theo bot).
- Test: 17 test cho key vault, rate limiter, client order id, và risk guard
  (gồm case fractional quantity mà float sẽ tính sai).

### Phase 2c — Đã xong (thư viện chiến lược + test suite)

**Thư viện chiến lược, user tự cấu hình**

8 chiến lược, mỗi cái **tự khai báo tham số của mình**; UI sinh form từ khai báo đó,
nên thêm chiến lược ở server không cần sửa frontend:

| Key | Tên | Nhóm |
|---|---|---|
| `rsi-reversal` | RSI Reversal | mean-reversion |
| `macd-cross` | MACD Crossover | momentum |
| `ema-cross` | EMA Cross (Golden/Death) | trend |
| `bollinger-reversion` | Bollinger Bands Reversion | mean-reversion |
| `stochastic-cross` | Stochastic Oscillator | momentum |
| `donchian-breakout` | Donchian Breakout | breakout |
| `supertrend` | Supertrend (ATR) | trend |
| `grid-dca` | Grid / DCA | mean-reversion |

- Chiến lược là **hàm thuần** `(candles, params) → Signal`. Đây là điểm mấu chốt:
  backtest được, unit test được, chạy ở worker nào cũng an toàn, và giữ phần *tiêu tiền*
  (đặt lệnh) hoàn toàn nằm ngoài code chiến lược.
- Indicator tự viết (`sma`, `ema`, `rsi` Wilder, `macd`, `bollinger`, `atr`, `stochastic`)
  thay vì phụ thuộc thư viện ngoài — cần kiểm soát chính xác cách căn chỉnh chỉ số và
  giai đoạn khởi động.
- `GET /api/strategies` trả catalog kèm `ParamSpec` (type, default, min/max, unit, help).
- Config được **validate hai lần**: khi tạo/sửa bot, và lại lần nữa khi chạy — bot lưu trong DB
  có thể cũ hơn thay đổi tham số của chiến lược.
- Tham số lạ bị **từ chối**, không phải bỏ qua: âm thầm bỏ qua khiến user tưởng hệ thống
  đã nghe lời mình.

**Test suite: 163 test (86 unit + 77 e2e), toàn bộ pass**

E2E chạy trên MySQL thật (`dokabot_test`), sàn được thay bằng fake adapter — e2e kiểm tra
*logic của mình*, không kiểm tra uptime của người khác:

- **Auth (21)**: hash bcrypt, chống dò email (wrong password và unknown email trả lời giống hệt),
  khoá tài khoản có hiệu lực ngay với token còn hạn, refresh token chỉ lưu hash, rotate mỗi lần,
  **phát hiện replay → thu hồi mọi phiên**, token hết hạn, logout.
- **API keys (14)**: secret không bao giờ lộ trong response hay DB, **từ chối key có quyền Withdraw**,
  revoke xoá sạch ciphertext, phát hiện khi user bật quyền rút *sau* khi đã kết nối.
- **Trading (33)**: idempotency (replay không mở lệnh thứ hai, **kể cả 3 request đồng thời** —
  đảm bảo nằm ở UNIQUE index chứ không ở code), lỗi retryable giữ `PENDING` còn lỗi vĩnh viễn
  mới `REJECTED`, paper không chạm sàn, xoá bot không mất lịch sử lệnh.
- **Tenant isolation**: mọi tài nguyên (API key / bot / order) đều có test cross-tenant,
  trả **404 chứ không 403** — nói cho Bob biết id đó tồn tại đã là rò rỉ.
- **Rate limiting (2)**: brute-force login bị chặn.
- **Chiến lược (29 + 20 indicator)**: mọi chiến lược phải trả signal đúng dạng trên 4 loại
  thị trường, không throw với input suy biến (toàn 0, số cực lớn), và **là hàm thuần**.

**Ba bug thật do test bắt được:**
1. `deriveClientOrderId` ghép chuỗi gây va chạm: `("a","b:c")` và `("a:b","c")` sinh cùng order id.
2. `confidenceFrom` trả `NaN` khi giá đi ngang (Bollinger sập dải → `0/0`) — NaN này sẽ chảy vào
   phần tính size vị thế.
3. `minCandles` cố định trong khi nhu cầu dữ liệu phụ thuộc tham số: EMA cross 50/200 cần 250 nến,
   nhưng cùng chiến lược ở 10/30 chỉ cần 50. User rút ngắn chu kỳ sẽ bị báo "thiếu dữ liệu" vĩnh viễn.

### Còn lại của Phase 2 (chưa làm)

- **Vòng lặp chạy bot chưa được nối**: chiến lược đã có, adapter đã có, đặt lệnh đã có,
  nhưng chưa có worker nào gọi `evaluate()` theo từng nến rồi đẩy signal thành lệnh.
  Đây là mắt xích còn thiếu giữa Phase 2 và Phase 3.
- Port 4 strategy cũ (ICT, mini reversal DCA, futures EMA, gold RSI) sang `IExchangeAdapter`.
  Cần test hồi quy trước vì đây là IP chính của sản phẩm.
- Contract test chạy chung cho cả hai adapter trên testnet.
- WebSocket stream trong adapter (hiện chỉ có REST).
- Reconciler hiện chạy in-process theo cron; Phase 3 chuyển vào execution worker,
  lấy user-data websocket làm nguồn chính và giữ poll này làm lưới an toàn.
