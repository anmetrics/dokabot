<template>
  <v-container fluid class="dashboard-container">
    <!-- Header Welcome -->
    <div class="welcome-header mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold mb-2">Xin chào 👋</h1>
        <p class="text-subtitle-1 text-secondary">
          {{ currentDate }}
        </p>
      </div>
    </div>

    <!-- Stats Cards Row -->
    <v-row class="mb-6">
      <!-- Total Running -->
      <v-col cols="12" sm="6" md="4">
        <v-card class="stat-card stat-card-purple">
          <div class="stat-icon-wrapper">
            <v-icon size="32" color="white">mdi-account-group</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">Tổng Đẩy Hui Đang Chạy</div>
            <div class="stat-value">{{ stats.totalRunning }}</div>
            <div class="stat-change positive">
              <v-icon size="16">mdi-arrow-up</v-icon>
              +{{ stats.runningChange }} so với tháng trước
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Total Flow -->
      <v-col cols="12" sm="6" md="4">
        <v-card class="stat-card stat-card-blue">
          <div class="stat-icon-wrapper">
            <v-icon size="32" color="white">mdi-wallet</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">Tổng Vốn Lưu Động</div>
            <div class="stat-value">{{ formatCurrency(stats.totalFlow) }}</div>
            <div class="stat-change positive">
              <v-icon size="16">mdi-arrow-up</v-icon>
              +{{ stats.flowChangePercent }}% so với tháng trước
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Total Income -->
      <v-col cols="12" sm="6" md="4">
        <v-card class="stat-card stat-card-green">
          <div class="stat-icon-wrapper">
            <v-icon size="32" color="white">mdi-trending-up</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">Thu Nhập Hoa Hồng (Tổng)</div>
            <div class="stat-value">
              {{ formatCurrency(stats.totalIncome) }}
            </div>
            <div class="stat-change positive">
              <v-icon size="16">mdi-arrow-up</v-icon>
              +{{ stats.incomeChangePercent }}% so với tháng trước
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Chart and Activity Row -->
    <v-row>
      <!-- Income Chart -->
      <v-col cols="12" lg="8">
        <v-card class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Biểu đồ thu nhập (Hoa hồng)</h3>
            <v-btn-toggle
              v-model="chartPeriod"
              density="compact"
              rounded="lg"
              class="chart-period-toggle"
            >
              <v-btn size="small" value="1m">1M</v-btn>
              <v-btn size="small" value="3m">3M</v-btn>
              <v-btn size="small" value="6m">6M</v-btn>
              <v-btn size="small" value="1y">1Y</v-btn>
            </v-btn-toggle>
          </div>
          <div class="chart-wrapper">
            <canvas ref="incomeChartCanvas"></canvas>
          </div>
        </v-card>
      </v-col>

      <!-- Recent Activity -->
      <v-col cols="12" lg="4">
        <v-card class="activity-card">
          <div class="activity-header">
            <v-icon color="primary" class="mr-2">mdi-update</v-icon>
            <h3 class="activity-title">Hoạt động gần đây</h3>
          </div>
          <v-divider class="my-3"></v-divider>
          <div class="activity-list">
            <div
              v-for="(activity, index) in recentActivities"
              :key="index"
              class="activity-item"
            >
              <div class="activity-icon">
                <v-icon size="20" :color="activity.iconColor">
                  {{ activity.icon }}
                </v-icon>
              </div>
              <div class="activity-content">
                <div class="activity-title-text">{{ activity.title }}</div>
                <div class="activity-subtitle">{{ activity.subtitle }}</div>
              </div>
              <div class="activity-value" :class="activity.valueClass">
                {{ activity.value }}
              </div>
              <div class="activity-date">{{ activity.date }}</div>
            </div>
          </div>
          <v-btn block variant="text" color="primary" class="mt-4">
            Xem tất cả
            <v-icon end>mdi-arrow-right</v-icon>
          </v-btn>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const incomeChartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

// Current date
const currentDate = computed(() => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  return now.toLocaleDateString("vi-VN", options);
});

// Stats data
const stats = ref({
  totalRunning: 2,
  runningChange: 0,
  totalFlow: 34150000,
  flowChangePercent: 0,
  totalIncome: 3200000,
  incomeChangePercent: 100,
});

// Chart period
const chartPeriod = ref("1m");

// Recent activities
const recentActivities = ref([
  {
    title: "Khui hui kỳ 2",
    subtitle: "Đạy Tháng 1tr- 2026",
    value: "6.500.000 đ",
    date: "11/1/2026",
    icon: "mdi-check-circle",
    iconColor: "success",
    valueClass: "text-success",
  },
  {
    title: "Khui hui kỳ 1",
    subtitle: "Hui luan 500k",
    value: "3.600.000 đ",
    date: "8/1/2026",
    icon: "mdi-check-circle",
    iconColor: "success",
    valueClass: "text-success",
  },
  {
    title: "Khui hui kỳ 10",
    subtitle: "Đạy hui Tháng 1tr",
    value: "8.800.000 đ",
    date: "7/1/2026",
    icon: "mdi-check-circle",
    iconColor: "success",
    valueClass: "text-success",
  },
  {
    title: "Khui hui kỳ 9",
    subtitle: "Đạy hui Tháng 1tr",
    value: "8.700.000 đ",
    date: "7/1/2026",
    icon: "mdi-check-circle",
    iconColor: "success",
    valueClass: "text-success",
  },
  {
    title: "Khui hui kỳ 8",
    subtitle: "Đạy hui Tháng 1tr",
    value: "8.600.000 đ",
    date: "7/1/2026",
    icon: "mdi-check-circle",
    iconColor: "success",
    valueClass: "text-success",
  },
]);

// Format currency
const formatCurrency = (value: number) => {
  return (
    new Intl.NumberFormat("vi-VN", {
      style: "decimal",
      minimumFractionDigits: 0,
    }).format(value) + " đ"
  );
};

// Create income chart
const createIncomeChart = () => {
  if (!incomeChartCanvas.value) return;
  if (chartInstance) chartInstance.destroy();

  const gradient = incomeChartCanvas.value
    .getContext("2d")
    ?.createLinearGradient(0, 0, 0, 300);
  gradient?.addColorStop(0, "rgba(124, 58, 237, 0.3)");
  gradient?.addColorStop(1, "rgba(124, 58, 237, 0)");

  chartInstance = new Chart(incomeChartCanvas.value, {
    type: "line",
    data: {
      labels: ["05-01", "06-01", "07-01", "08-01", "11-01"],
      datasets: [
        {
          label: "Thu nhập (đ)",
          data: [550000, 1200000, 2200000, 1800000, 800000],
          borderColor: "#7C3AED",
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointBackgroundColor: "#7C3AED",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(30, 41, 59, 0.95)",
          titleColor: "#F1F5F9",
          bodyColor: "#F1F5F9",
          borderColor: "#7C3AED",
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: (context) => `${formatCurrency(context.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: "rgba(241, 245, 249, 0.05)",
            drawBorder: false,
          },
          ticks: {
            color: "#94A3B8",
            font: {
              size: 12,
            },
          },
        },
        y: {
          grid: {
            color: "rgba(241, 245, 249, 0.05)",
            drawBorder: false,
          },
          ticks: {
            color: "#94A3B8",
            font: {
              size: 12,
            },
            callback: (value) => {
              const num = Number(value);
              if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
              if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
              return num.toString();
            },
          },
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
    },
  });
};

onMounted(() => {
  createIncomeChart();
});
</script>

<style scoped>
.dashboard-container {
  max-width: 1400px;
  padding: 24px;
  background: transparent;
}

/* Welcome Header */
.welcome-header h1 {
  color: #f1f5f9;
  font-weight: 700;
}

.text-secondary {
  color: #94a3b8;
}

/* Stat Cards */
.stat-card {
  position: relative;
  padding: 24px;
  border-radius: 20px;
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border: 1px solid rgba(167, 139, 250, 0.1);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(124, 58, 237, 0.2);
}

.stat-card-purple {
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
}

.stat-card-blue {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.stat-card-green {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.stat-icon-wrapper {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.stat-content {
  position: relative;
  z-index: 1;
}

.stat-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 8px;
  font-weight: 500;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 8px;
  line-height: 1.2;
}

.stat-change {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.9);
}

.stat-change.positive {
  color: rgba(255, 255, 255, 0.95);
}

/* Chart Card */
.chart-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  height: 100%;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.chart-title {
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
}

.chart-period-toggle {
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
}

.chart-wrapper {
  width: 100%;
  height: 320px;
}

/* Activity Card */
.activity-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  height: 100%;
}

.activity-header {
  display: flex;
  align-items: center;
}

.activity-title {
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
}

.activity-list {
  max-height: 380px;
  overflow-y: auto;
  padding-right: 8px;
}

.activity-list::-webkit-scrollbar {
  width: 6px;
}

.activity-list::-webkit-scrollbar-thumb {
  background: rgba(167, 139, 250, 0.3);
  border-radius: 3px;
}

.activity-list::-webkit-scrollbar-track {
  background: transparent;
}

.activity-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto auto;
  gap: 8px;
  padding: 16px 12px;
  border-radius: 12px;
  transition: background 0.2s ease;
  margin-bottom: 8px;
}

.activity-item:hover {
  background: rgba(167, 139, 250, 0.05);
}

.activity-icon {
  grid-row: 1 / 3;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 10px;
}

.activity-content {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity-title-text {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.activity-subtitle {
  font-size: 12px;
  color: #94a3b8;
}

.activity-value {
  grid-column: 3;
  grid-row: 1;
  font-size: 14px;
  font-weight: 700;
  text-align: right;
}

.activity-value.text-success {
  color: #10b981;
}

.activity-date {
  grid-column: 3;
  grid-row: 2;
  font-size: 11px;
  color: #64748b;
  text-align: right;
}

/* Responsive */
@media (max-width: 960px) {
  .dashboard-container {
    padding: 16px;
  }

  .stat-card {
    padding: 20px;
  }

  .stat-value {
    font-size: 24px;
  }

  .chart-wrapper {
    height: 260px;
  }
}

@media (max-width: 600px) {
  .welcome-header h1 {
    font-size: 24px;
  }

  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .stat-icon-wrapper {
    width: 48px;
    height: 48px;
  }

  .stat-icon-wrapper .v-icon {
    font-size: 24px !important;
  }

  .chart-wrapper {
    height: 220px;
  }
}

@media (max-width: 480px) {
  .dashboard-container {
    padding: 12px;
  }

  .welcome-header h1 {
    font-size: 20px;
  }

  .stat-card {
    padding: 8px 4px;
  }

  .stat-icon-wrapper {
    width: 40px;
    height: 40px;
  }

  .stat-icon-wrapper .v-icon {
    font-size: 20px !important;
  }

  .stat-value {
    font-size: 18px;
  }

  .stat-label {
    font-size: 11px;
  }

  .period-btn {
    padding: 4px 8px;
    font-size: 9px;
    min-height: 28px;
  }

  .chart-wrapper {
    height: 200px;
  }

  .activity-card {
    padding: 8px 4px;
  }

  .activity-title-text {
    font-size: 12px;
  }

  .activity-subtitle {
    font-size: 10px;
  }

  .activity-value {
    font-size: 12px;
  }

  .activity-date {
    font-size: 9px;
  }
}
</style>
