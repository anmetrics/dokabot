<template>
  <v-container fluid class="sideway-page pa-4">
    <div class="sideway-wrapper">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <v-icon size="20" color="#a78bfa">mdi-swap-vertical-bold</v-icon>
          <span class="header-title">Kịch bản Sideway</span>
        </div>
        <v-btn size="small" variant="flat" class="create-btn" @click="openCreateDialog">
          <v-icon size="16" start>mdi-plus</v-icon>
          Tạo mới
        </v-btn>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <v-progress-circular indeterminate color="#a78bfa" size="32" />
      </div>

      <!-- Empty State -->
      <div v-else-if="scenarios.length === 0" class="empty-state">
        <v-icon size="48" color="#475569">mdi-swap-vertical-bold</v-icon>
        <span>Chưa có kịch bản nào</span>
        <v-btn size="small" variant="flat" class="create-btn" @click="openCreateDialog">
          Tạo kịch bản đầu tiên
        </v-btn>
      </div>

      <!-- Scenario List -->
      <div v-else class="scenario-list">
        <div v-for="scenario in scenarios" :key="scenario.id" class="scenario-card">
          <!-- Card Header -->
          <div class="card-header">
            <div class="card-header-left">
              <span class="scenario-name">{{ scenario.name }}</span>
              <span :class="['status-badge', scenario.status]">
                {{ statusLabel(scenario.status) }}
              </span>
            </div>
            <div class="card-actions">
              <v-btn
                icon
                size="x-small"
                :color="scenario.enabled ? '#ef4444' : '#10b981'"
                variant="text"
                @click="toggleScenario(scenario)"
                :loading="togglingId === scenario.id"
              >
                <v-icon size="18">{{ scenario.enabled ? 'mdi-stop' : 'mdi-play' }}</v-icon>
              </v-btn>
              <v-btn icon size="x-small" color="#64748b" variant="text" @click="openEditDialog(scenario)">
                <v-icon size="18">mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon size="x-small" color="#64748b" variant="text" @click="confirmDelete(scenario)">
                <v-icon size="18">mdi-delete</v-icon>
              </v-btn>
              <v-btn
                v-if="scenario.status === 'completed' || scenario.status === 'error'"
                icon size="x-small" color="#f59e0b" variant="text"
                @click="resetScenario(scenario)"
              >
                <v-icon size="18">mdi-refresh</v-icon>
              </v-btn>
            </div>
          </div>

          <!-- Card Info -->
          <div class="card-info">
            <div class="info-item">
              <span class="info-label">Symbol</span>
              <span class="info-value">{{ scenario.symbol }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Số lượng</span>
              <span class="info-value">{{ scenario.qty }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Giá hiện tại</span>
              <span class="info-value price">{{ formatPrice(scenario.currentPrice) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Lặp lại</span>
              <span class="info-value">{{ scenario.isLoop ? 'Có' : 'Không' }}</span>
            </div>
          </div>

          <!-- Steps Timeline -->
          <div class="steps-timeline">
            <div
              v-for="(step, idx) in scenario.steps"
              :key="idx"
              :class="['step-item', {
                active: scenario.enabled && idx === scenario.currentStepIndex,
                completed: idx < scenario.currentStepIndex,
                sell: step.action === 'SELL',
                buy: step.action === 'BUY',
              }]"
            >
              <div class="step-dot"></div>
              <div class="step-content">
                <span class="step-action">{{ step.action === 'BUY' ? 'MUA' : 'BÁN' }}</span>
                <span class="step-price">{{ formatPrice(step.price) }}</span>
              </div>
              <div v-if="idx < scenario.steps.length - 1" class="step-line"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <v-dialog v-model="dialog" max-width="500" persistent>
      <v-card class="dialog-card">
        <v-card-title class="dialog-title">
          {{ editingId ? 'Sửa kịch bản' : 'Tạo kịch bản mới' }}
        </v-card-title>
        <v-card-text class="dialog-content">
          <!-- Name -->
          <div class="form-group">
            <label class="form-label">Tên kịch bản</label>
            <input v-model="form.name" type="text" class="form-input" placeholder="VD: BNB Sideway 600-630" />
          </div>

          <!-- Symbol -->
          <div class="form-group">
            <label class="form-label">Symbol</label>
            <select v-model="form.symbol" class="form-input">
              <option value="BNBUSDT">BNBUSDT</option>
              <option value="BTCUSDT">BTCUSDT</option>
              <option value="SOLUSDT">SOLUSDT</option>
              <option value="PAXGUSDT">PAXGUSDT</option>
            </select>
          </div>

          <!-- Quantity -->
          <div class="form-group">
            <label class="form-label">Số lượng coin mỗi bước</label>
            <input v-model.number="form.qty" type="number" step="0.001" class="form-input" placeholder="VD: 0.1" />
          </div>

          <!-- Loop -->
          <div class="form-group">
            <label class="form-label toggle-label">
              <span>Lặp lại sau khi hoàn thành</span>
              <v-switch
                v-model="form.isLoop"
                color="secondary"
                density="compact"
                hide-details
              />
            </label>
          </div>

          <!-- Steps -->
          <div class="form-group">
            <div class="steps-header">
              <label class="form-label">Các bước</label>
              <v-btn size="x-small" variant="flat" class="add-step-btn" @click="addStep">
                <v-icon size="14" start>mdi-plus</v-icon>
                Thêm bước
              </v-btn>
            </div>
            <div class="steps-form-list">
              <div v-for="(step, idx) in form.steps" :key="idx" class="step-form-item">
                <span class="step-number">{{ idx + 1 }}</span>
                <select v-model="step.action" class="form-input step-action-select">
                  <option value="SELL">BÁN</option>
                  <option value="BUY">MUA</option>
                </select>
                <input
                  v-model.number="step.price"
                  type="number"
                  step="0.01"
                  class="form-input step-price-input"
                  placeholder="Giá"
                />
                <v-btn
                  icon
                  size="x-small"
                  color="#ef4444"
                  variant="text"
                  @click="removeStep(idx)"
                  :disabled="form.steps.length <= 2"
                >
                  <v-icon size="16">mdi-close</v-icon>
                </v-btn>
              </div>
            </div>
          </div>
        </v-card-text>
        <v-card-actions class="dialog-actions">
          <v-btn variant="text" color="#94a3b8" @click="dialog = false">Huỷ</v-btn>
          <v-btn variant="flat" class="save-btn" @click="saveScenario" :loading="saving">
            {{ editingId ? 'Cập nhật' : 'Tạo' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirm Dialog -->
    <v-dialog v-model="deleteDialog" max-width="360">
      <v-card class="dialog-card">
        <v-card-title class="dialog-title">Xác nhận xoá</v-card-title>
        <v-card-text class="dialog-content">
          Bạn có chắc muốn xoá kịch bản <strong>{{ deletingScenario?.name }}</strong>?
        </v-card-text>
        <v-card-actions class="dialog-actions">
          <v-btn variant="text" color="#94a3b8" @click="deleteDialog = false">Huỷ</v-btn>
          <v-btn variant="flat" color="error" @click="doDelete" :loading="deleting">Xoá</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2500" location="top">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useApi } from "~/apis";

interface ScenarioStep {
  action: "BUY" | "SELL";
  price: number;
}

interface Scenario {
  id: string;
  name: string;
  symbol: string;
  qty: number;
  steps: ScenarioStep[];
  currentStepIndex: number;
  isLoop: boolean;
  enabled: boolean;
  status: string;
  currentPrice: number;
  lastExecutedAt: string | null;
}

const api = useApi();
const scenarios = ref<Scenario[]>([]);
const loading = ref(true);
const dialog = ref(false);
const deleteDialog = ref(false);
const saving = ref(false);
const deleting = ref(false);
const editingId = ref<string | null>(null);
const togglingId = ref<string | null>(null);
const deletingScenario = ref<Scenario | null>(null);

const snackbar = ref({ show: false, message: "", color: "success" });

const form = ref({
  name: "",
  symbol: "BNBUSDT",
  qty: 0.1,
  isLoop: false,
  steps: [
    { action: "SELL" as const, price: 0 },
    { action: "BUY" as const, price: 0 },
  ],
});

let refreshInterval: ReturnType<typeof setInterval> | null = null;

function statusLabel(status: string) {
  const map: Record<string, string> = {
    idle: "Chờ",
    running: "Đang chạy",
    completed: "Hoàn thành",
    error: "Lỗi",
  };
  return map[status] || status;
}

function formatPrice(price: number) {
  if (!price) return "—";
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchScenarios() {
  try {
    const res = await api.get<Scenario[]>("sideway");
    scenarios.value = res;
  } catch {
    snackbar.value = { show: true, message: "Lỗi tải dữ liệu", color: "error" };
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  editingId.value = null;
  form.value = {
    name: "",
    symbol: "BNBUSDT",
    qty: 0.1,
    isLoop: false,
    steps: [
      { action: "SELL", price: 0 },
      { action: "BUY", price: 0 },
    ],
  };
  dialog.value = true;
}

function openEditDialog(scenario: Scenario) {
  if (scenario.enabled) {
    snackbar.value = { show: true, message: "Tắt kịch bản trước khi sửa", color: "warning" };
    return;
  }
  editingId.value = scenario.id;
  form.value = {
    name: scenario.name,
    symbol: scenario.symbol,
    qty: scenario.qty,
    isLoop: scenario.isLoop,
    steps: [...scenario.steps],
  };
  dialog.value = true;
}

function addStep() {
  form.value.steps.push({ action: "SELL", price: 0 });
}

function removeStep(idx: number) {
  if (form.value.steps.length > 2) {
    form.value.steps.splice(idx, 1);
  }
}

async function saveScenario() {
  if (!form.value.name.trim()) {
    snackbar.value = { show: true, message: "Nhập tên kịch bản", color: "warning" };
    return;
  }
  if (form.value.qty <= 0) {
    snackbar.value = { show: true, message: "Số lượng phải > 0", color: "warning" };
    return;
  }
  const invalidStep = form.value.steps.find((s) => !s.price || s.price <= 0);
  if (invalidStep) {
    snackbar.value = { show: true, message: "Giá mỗi bước phải > 0", color: "warning" };
    return;
  }

  saving.value = true;
  try {
    if (editingId.value) {
      await api.patch(`sideway/${editingId.value}`, form.value);
      snackbar.value = { show: true, message: "Đã cập nhật", color: "success" };
    } else {
      await api.post("sideway", form.value);
      snackbar.value = { show: true, message: "Đã tạo kịch bản", color: "success" };
    }
    dialog.value = false;
    await fetchScenarios();
  } catch {
    snackbar.value = { show: true, message: "Lỗi lưu kịch bản", color: "error" };
  } finally {
    saving.value = false;
  }
}

async function toggleScenario(scenario: Scenario) {
  togglingId.value = scenario.id;
  try {
    await api.post(`sideway/${scenario.id}/toggle`);
    await fetchScenarios();
    snackbar.value = {
      show: true,
      message: scenario.enabled ? "Đã tắt kịch bản" : "Đã bật kịch bản",
      color: "success",
    };
  } catch {
    snackbar.value = { show: true, message: "Lỗi", color: "error" };
  } finally {
    togglingId.value = null;
  }
}

function confirmDelete(scenario: Scenario) {
  if (scenario.enabled) {
    snackbar.value = { show: true, message: "Tắt kịch bản trước khi xoá", color: "warning" };
    return;
  }
  deletingScenario.value = scenario;
  deleteDialog.value = true;
}

async function doDelete() {
  if (!deletingScenario.value) return;
  deleting.value = true;
  try {
    await api.delete(`sideway/${deletingScenario.value.id}`);
    deleteDialog.value = false;
    snackbar.value = { show: true, message: "Đã xoá", color: "success" };
    await fetchScenarios();
  } catch {
    snackbar.value = { show: true, message: "Lỗi xoá", color: "error" };
  } finally {
    deleting.value = false;
  }
}

async function resetScenario(scenario: Scenario) {
  try {
    await api.post(`sideway/${scenario.id}/reset`);
    snackbar.value = { show: true, message: "Đã reset kịch bản", color: "success" };
    await fetchScenarios();
  } catch {
    snackbar.value = { show: true, message: "Lỗi reset", color: "error" };
  }
}

onMounted(() => {
  fetchScenarios();
  // Auto refresh every 10 seconds
  refreshInterval = setInterval(fetchScenarios, 10_000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});
</script>

<style scoped>
.sideway-page {
  display: flex;
  justify-content: center;
  min-height: 100vh;
  background: #0f172a;
}

.sideway-wrapper {
  width: 100%;
  max-width: 600px;
  padding: 8px 0;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #1e293b;
  border-radius: 10px;
  margin-bottom: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
}

.create-btn {
  background: linear-gradient(135deg, #7c3aed, #a78bfa) !important;
  color: white !important;
  font-size: 12px;
  font-weight: 600;
  text-transform: none;
  border-radius: 6px;
  padding: 0 12px !important;
  height: 28px !important;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 20px;
  color: #475569;
  font-size: 14px;
  background: #1e293b;
  border-radius: 10px;
}

.scenario-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Scenario Card */
.scenario-card {
  background: #1e293b;
  border-radius: 10px;
  padding: 16px;
  border: 1px solid #334155;
  transition: border-color 0.2s;
}

.scenario-card:hover {
  border-color: rgba(167, 139, 250, 0.3);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scenario-name {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.status-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.idle {
  background: rgba(100, 116, 139, 0.2);
  color: #94a3b8;
}

.status-badge.running {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  animation: pulse 2s infinite;
}

.status-badge.completed {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.status-badge.error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.card-actions {
  display: flex;
  gap: 2px;
}

.card-info {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px;
  background: #0f172a;
  border-radius: 8px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 10px;
  color: #64748b;
  font-weight: 500;
}

.info-value {
  font-size: 13px;
  color: #e2e8f0;
  font-weight: 600;
}

.info-value.price {
  color: #f59e0b;
}

/* Steps Timeline */
.steps-timeline {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  align-items: center;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
}

.step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #334155;
  border: 2px solid #475569;
  flex-shrink: 0;
  transition: all 0.3s;
}

.step-item.active .step-dot {
  background: #a78bfa;
  border-color: #7c3aed;
  box-shadow: 0 0 8px rgba(124, 58, 237, 0.5);
}

.step-item.completed .step-dot {
  background: #10b981;
  border-color: #059669;
}

.step-item.sell .step-content .step-action {
  color: #ef4444;
}

.step-item.buy .step-content .step-action {
  color: #10b981;
}

.step-content {
  display: flex;
  gap: 4px;
  align-items: center;
}

.step-action {
  font-size: 11px;
  font-weight: 700;
}

.step-price {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
}

.step-line {
  width: 20px;
  height: 2px;
  background: #334155;
  margin: 0 4px;
}

.step-item.completed + .step-item .step-line,
.step-item.completed .step-line {
  background: #10b981;
}

/* Dialog */
.dialog-card {
  background: #1e293b !important;
  border: 1px solid #334155;
  border-radius: 12px !important;
}

.dialog-title {
  color: #f1f5f9 !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  padding: 16px 20px 8px !important;
}

.dialog-content {
  padding: 12px 20px !important;
}

.dialog-actions {
  padding: 8px 16px 16px !important;
  justify-content: flex-end;
}

.form-group {
  margin-bottom: 14px;
}

.form-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.toggle-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle-label span {
  font-size: 13px;
  color: #e2e8f0;
  text-transform: none;
  letter-spacing: normal;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 8px 10px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #f1f5f9;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #7c3aed;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
}

.form-input option {
  background: #1e293b;
  color: #f1f5f9;
}

.steps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.add-step-btn {
  background: rgba(167, 139, 250, 0.15) !important;
  color: #a78bfa !important;
  font-size: 11px;
  text-transform: none;
  border-radius: 4px;
  height: 24px !important;
}

.steps-form-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-form-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-number {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #334155;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  flex-shrink: 0;
}

.step-action-select {
  width: 80px !important;
  flex-shrink: 0;
}

.step-price-input {
  flex: 1;
}

.save-btn {
  background: linear-gradient(135deg, #7c3aed, #a78bfa) !important;
  color: white !important;
  font-size: 13px;
  font-weight: 600;
  text-transform: none;
  border-radius: 6px;
}

/* Compact switch in dialog */
:deep(.v-switch) {
  transform: scale(0.8);
  transform-origin: right center;
}

/* Responsive */
@media (max-width: 600px) {
  .sideway-wrapper {
    padding: 0;
  }

  .card-info {
    grid-template-columns: repeat(2, 1fr);
  }

  .steps-timeline {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .step-line {
    display: none;
  }
}
</style>
