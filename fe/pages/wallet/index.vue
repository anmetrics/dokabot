<template>
  <v-container class="py-10 position-page">
    <h1 class="text-h4 font-weight-bold mb-8">Vị thế của bạn</h1>

    <!-- Wallet Box -->
    <v-card
      class="wallet-box mx-auto rounded-xl pa-10 d-flex flex-column align-center justify-center"
      elevation="0"
    >
      <v-avatar size="60" class="mb-4 wallet-icon">
        <v-icon size="40">mdi-wallet-outline</v-icon>
      </v-avatar>

      <h2 class="text-h6 font-weight-bold mb-2">Kết nối ví của bạn</h2>
      <p class="text-body-2 text-medium-emphasis mb-6 text-center">
        Bạn cần kết nối ví để xem các vị thế và phần thưởng của bạn.
      </p>

      <div class="d-flex gap-3">
        <v-btn
          variant="outlined"
          color="white"
          height="44"
          class="rounded-lg wallet-btn"
        >
          Vị thế mới
        </v-btn>

        <v-btn
          color="white"
          height="44"
          class="rounded-lg wallet-btn-dark text-black font-weight-medium"
        >
          Kết nối ví
        </v-btn>
      </div>
    </v-card>

    <!-- Options list -->
    <div class="mt-10 d-flex flex-column gap-4">
      <!-- Card item -->
      <v-card
        class="option-card d-flex align-center rounded-xl pa-0 overflow-hidden"
        elevation="0"
        @click="navigate('/liquidity')"
      >
        <div class="option-icon">
          <v-icon size="38" color="white">mdi-trending-up</v-icon>
        </div>

        <div class="px-4 py-5 text-body-1 font-weight-medium">
          Cung cấp thanh khoản trên các giao thức khác nhau
        </div>
      </v-card>

      <v-card
        class="option-card d-flex align-center rounded-xl pa-0 overflow-hidden"
        elevation="0"
        @click="navigate('/hooks-v4')"
      >
        <div class="option-icon-light">
          <v-icon size="38" color="black">mdi-book-open-page-variant</v-icon>
        </div>

        <div class="px-4 py-5 text-body-1 font-weight-medium">Hook trên v4</div>
      </v-card>
    </div>
  </v-container>
</template>

<script setup>
const navigate = (path) => {
  navigateTo(path);
};
</script>

<style scoped>
.position-page {
  max-width: 850px;
}

/* Wallet box */
.wallet-box {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(14px);
}

/* Wallet icon container */
.wallet-icon {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

/* Buttons */
.wallet-btn {
  border-radius: 14px !important;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.wallet-btn-dark {
  background: white !important;
}

/* Option cards */
.option-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  transition: 0.25s ease;
  cursor: pointer;
}

.option-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-2px);
}

/* Icons on left side */
.option-icon {
  background: #ff3db3;
  width: 80px;
  height: 100%;
  min-height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.option-icon-light {
  background: #ffffff;
  width: 80px;
  height: 100%;
  min-height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
