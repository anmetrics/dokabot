Dùng EMA 20 + EMA 50 để xác định xu hướng chính.

Quan sát RSI/Stochastic để vào lệnh khi có tín hiệu quá mua/quá bán theo xu hướng.

Xác nhận thêm bằng volume tăng hoặc phá vỡ Bollinger Bands.

---

1. Kết hợp EMA + RSI (Trend + Momentum)

Cách hoạt động:

EMA xác định trend ngắn hạn.

RSI xác định điểm vào ra quá bán/quá mua trong trend.

Ưu điểm: giảm nhiễu tín hiệu, hiệu quả cho scalping.

Ví dụ:

Trend tăng: mua khi RSI < 40.

Trend giảm: bán khi RSI > 60.

---

1. Trend-following kết hợp với động lượng

Mục đích: Xác định xu hướng chính và sức mạnh xu hướng, tránh mua bán khi thị trường sideway.

MA + MACD

MA xác định xu hướng (EMA 50, EMA 200).

MACD xác nhận động lực (momentum) của xu hướng.

Ví dụ tín hiệu bot: EMA ngắn cắt EMA dài + MACD histogram tăng → mua.

Giải thích: MA báo xu hướng → MACD lọc các tín hiệu giả.

EMA + RSI

EMA xác định hướng chính.

RSI lọc tín hiệu quá mua/quá bán.

Ví dụ tín hiệu bot: Giá trên EMA 50 + RSI < 30 → tín hiệu mua mạnh.

2. Bollinger Band + RSI

Mục đích: Tận dụng biến động giá và xác định quá mua/quá bán.

Giá chạm dải dưới Bollinger Band + RSI < 30 → mua.

Giá chạm dải trên Bollinger Band + RSI > 70 → bán.

Bot: thường dùng cho thị trường sideway hoặc swing trading ngắn hạn, tránh tín hiệu giả khi thị trường có breakout.

3. Volume + MA/MACD

Mục đích: Xác nhận breakout và xu hướng thực sự.

Giá vượt EMA 50 → chỉ giao dịch nếu volume tăng mạnh.

MACD cắt đường tín hiệu → chỉ xác nhận khi volume đồng thuận.

Bot: giúp tránh tình trạng false breakout, đặc biệt khi thị trường biến động mạnh.

4. Grid/Scalping + RSI hoặc Stochastic

Mục đích: Dùng cho bot đặt lệnh liên tục trong khoảng giá xác định.

Bot đặt lệnh mua/bán theo grid.

Chỉ thực hiện lệnh khi RSI hoặc Stochastic báo quá bán/quá mua trong ngắn hạn.

Hiệu quả: Giảm lệnh thua liên tục trong giai đoạn sideway.

1. EMA + MACD

Mục đích: Xác định xu hướng chính + động lực thị trường.

Tại sao tốt:

EMA nhạy với xu hướng giá, MACD xác nhận động lực → giảm tín hiệu giả.

Ví dụ: EMA 50 cắt EMA 200 lên + MACD histogram tăng → tín hiệu mua mạnh.

Ứng dụng: Trend-following bot, swing trading.

2. Bollinger Bands + RSI

Mục đích: Xác định điểm quá mua/quá bán trong thị trường biến động (sideway hoặc ngắn hạn).

Tại sao tốt:

Bollinger đo độ biến động, RSI lọc tín hiệu giả → tránh mua khi giá đang “bong bóng”.

Ví dụ: Giá chạm dải dưới + RSI < 30 → mua. Giá chạm dải trên + RSI > 70 → bán.

Ứng dụng: Scalping bot hoặc swing trading trong kênh giá.

3. EMA + RSI

Mục đích: Xác định xu hướng + điểm vào ra tốt.

Tại sao tốt:

EMA xác định trend, RSI xác định thời điểm giá quá mua/quá bán.

Ví dụ: Giá trên EMA 50 + RSI < 40 → mua; Giá dưới EMA 50 + RSI > 60 → bán.

Ứng dụng: Bot trend-following kết hợp filter RSI.

4. EMA + MACD + Volume

Mục đích: Xác nhận xu hướng + động lực + khối lượng thực sự.

Tại sao tốt:

EMA + MACD → xu hướng + momentum, volume → xác nhận breakout.

Ứng dụng: Bot chuyên breakout hoặc swing/trend dài hạn.

Ví dụ: EMA tăng + MACD bullish + volume tăng mạnh → mua.
