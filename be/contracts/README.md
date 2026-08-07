# SubscriptionManager (BSC)

## Câu trả lời ngắn cho ba câu hỏi

**Dùng permit được không?** Không, với USDT trên BSC.
`BSC-USD` (`0x55d398326f99059fF775485246999027B3197955`) — đồng USDT mà thực tế mọi người
giữ trên BSC — **không implement EIP-2612**. Binance-Peg USDC cũng vậy. Nếu bắt buộc permit
thì sản phẩm chỉ nhận được những token gần như không ai dùng.
Luồng thực tế: user gọi `approve()` một lần trên token, sau đó hệ thống `transferFrom` hàng tháng.

**Có cần contract không?** Về mặt chức năng thì không — `approve(EOA của hệ thống)` rồi backend
gọi `transferFrom` là đủ, và event `Transfer` của ERC20 cũng đủ để biết ai đã trả.

Nhưng **nên có**, vì lý do duy nhất này: `approve` không giới hạn cho một EOA nghĩa là
**một private key bị lộ sẽ rút sạch toàn bộ USDT của mọi subscriber**, ngay lập tức và không thu hồi được.

Contract này giới hạn thiệt hại đó. Kẻ tấn công nắm trọn charger key cũng chỉ lấy được
tối đa `maxChargeAmount` mỗi subscriber mỗi `period`, và chỉ chuyển được về `treasury`
(do owner đặt, không phải charger).

**Backend nghe websocket được không?** Được, `eth_subscribe` vào log của contract.
Nhưng phải xử lý reorg và mất kết nối — xem phần dưới.

## Deploy

```
constructor(
  token_        = 0x55d398326f99059fF775485246999027B3197955  // BSC-USD (USDT), 18 decimals
  treasury_     = ví nhận tiền
  charger_      = ví backend dùng để gọi charge()
  maxChargeAmount_ = 4e18   // trần cứng 4 USDT mỗi lần
  period_       = 2592000   // 30 ngày
  tokenDecimals_= 18        // LƯU Ý: USDT trên BSC là 18 decimals, không phải 6 như Ethereum
)
```

`maxChargeAmount` và `period` là `immutable`: sau khi deploy không ai — kể cả owner —
nâng được trần. Muốn đổi giá thì deploy contract mới và cho user chuyển sang.

## Luồng người dùng

1. Kết nối ví, ký một nonce để chứng minh sở hữu địa chỉ (backend xác minh chữ ký).
2. `approve(SubscriptionManager, số lớn)` trên token USDT.
3. `subscribe()` trên contract — địa chỉ trong event là `msg.sender` nên **backend không cần
   tin vào địa chỉ do client gửi lên**.
4. Backend gọi `charge(user, 4e18)` mỗi 30 ngày; event `Charged` là bằng chứng đã thu.
5. User `unsubscribe()` bất cứ lúc nào — huỷ ở đây chặn được pull kể cả khi approval còn nguyên.

## Những điểm dễ sai khi nghe event

- **Reorg**: chỉ ghi nhận thanh toán sau N block xác nhận (BSC ~15 là an toàn).
  Ghi ngay ở block đầu sẽ có ngày cấp Pro cho một giao dịch bị rollback.
- **Mất kết nối**: websocket rớt là chuyện thường. Phải lưu block cuối đã xử lý và
  **backfill bằng `eth_getLogs`** khi kết nối lại, nếu không sẽ mất thanh toán trong lúc rớt mạng.
- **Trùng lặp**: khoá idempotency là `(transactionHash, logIndex)`, không phải địa chỉ user.
- **Không tin `Transfer` của token làm bằng chứng**: bất kỳ ai cũng chuyển được USDT vào
  treasury. Chỉ event `Charged` của chính contract này mới chứng minh đúng subscriber nào đã trả.

## Test contract

Chưa có test Solidity trong repo này (chưa cài Foundry/Hardhat).
**Không deploy lên mainnet trước khi có test và một lần audit** — đây là code giữ tiền.
