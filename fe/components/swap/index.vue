<template>
  <div class="swap-container">
    <!-- Phần You Pay -->
    <div class="swap-box">
      <div class="swap-header">
        <span>You Pay</span>
        <span class="balance">Balance: 52.34 BNB <a href="#" class="max-link">Max</a></span>
      </div>
      <div class="swap-input">
        <select class="coin-select">
          <option value="bnb">
            BNB
          </option>
          <option value="eth">
            ETH
          </option>
          <option value="usdt">
            USDT
          </option>
        </select>
        <input v-model="payAmount" type="number" placeholder="0.01">
      </div>
      <div class="swap-value">
        ≈ 6,247770 USD
      </div>
    </div>

    <!-- Nút chuyển đổi -->
    <div class="swap-icon">
      <span>↓↑</span>
    </div>

    <!-- Phần You Receive -->
    <div class="swap-box">
      <div class="swap-header">
        <span>You Receive</span>
        <span class="balance">Balance: 187.52 USDT</span>
      </div>
      <div class="swap-input">
        <select class="coin-select">
          <option value="usdt">
            USDT
          </option>
          <option value="bnb">
            BNB
          </option>
          <option value="eth">
            ETH
          </option>
        </select>
        <input v-model="receiveAmount" type="number" placeholder="0" readonly>
      </div>
      <div class="swap-value">
        ≈ 28,197.64 USD
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// State cho số lượng
const payAmount = ref(0.01)
const receiveAmount = ref(67345108344) // Giá trị mặc định ví dụ
</script>

  <style scoped>
  .swap-container {
    max-width: 400px;
    margin: 50px auto;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    padding: 20px;
    font-family: Arial, sans-serif;
  }

  .swap-box {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 10px;
  }

  .swap-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    font-size: 14px;
    color: #333;
  }

  .balance {
    color: #666;
  }

  .max-link {
    color: #007bff;
    text-decoration: none;
  }

  .max-link:hover {
    text-decoration: underline;
  }

  .swap-input {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .coin-select {
    padding: 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    font-size: 16px;
    background: #f9f9f9;
    cursor: pointer;
  }

  .coin-select:focus {
    outline: none;
    border-color: #007bff;
  }

  input[type="number"] {
    flex: 1;
    padding: 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    font-size: 16px;
    background: #f9f9f9;
  }

  input[type="number"]:focus {
    outline: none;
    border-color: #007bff;
  }

  .swap-value {
    margin-top: 8px;
    font-size: 12px;
    color: #666;
    text-align: right;
  }

  .swap-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 32px;
    height: 32px;
    margin: 10px auto;
    background: #f0f0f0;
    border-radius: 50%;
    font-size: 16px;
    color: #333;
    cursor: pointer;
  }

  .swap-icon:hover {
    background: #e0e0e0;
  }
  </style>
