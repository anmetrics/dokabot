<template>
  <div class="rule-builder">
    <div class="rb-head">
      <div class="rb-logic">
        <span class="rb-logic-label">Khớp khi</span>
        <v-btn-toggle
          :model-value="group.logic"
          density="compact"
          mandatory
          class="rb-toggle"
          @update:model-value="setLogic"
        >
          <v-btn value="AND" size="small">TẤT CẢ (AND)</v-btn>
          <v-btn value="OR" size="small">BẤT KỲ (OR)</v-btn>
        </v-btn-toggle>
      </div>
      <v-btn size="small" variant="tonal" class="rb-add" @click="addCondition">
        <v-icon start size="16">mdi-plus</v-icon> Thêm điều kiện
      </v-btn>
    </div>

    <p v-if="!group.conditions.length" class="rb-empty">
      Chưa có điều kiện nào — bot sẽ không bao giờ vào lệnh theo nhóm này.
    </p>

    <div
      v-for="(condition, index) in group.conditions"
      :key="index"
      class="rb-row"
    >
      <span class="rb-index">{{ index === 0 ? "KHI" : group.logic }}</span>

      <!-- LEFT -->
      <div class="rb-operand">
        <v-select
          :model-value="condition.left.type"
          :items="operandTypes"
          item-title="label"
          item-value="value"
          density="compact"
          variant="outlined"
          hide-details
          class="rb-field rb-narrow"
          @update:model-value="(v) => setOperandType(condition, 'left', v)"
        />
        <template v-if="condition.left.type === 'indicator'">
          <v-select
            :model-value="condition.left.name"
            :items="indicatorItems"
            item-title="label"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            class="rb-field"
            @update:model-value="(v) => setIndicator(condition, 'left', v)"
          />
          <v-select
            v-if="outputsFor(condition.left).length > 1"
            :model-value="condition.left.output"
            :items="outputsFor(condition.left)"
            item-title="label"
            item-value="key"
            density="compact"
            variant="outlined"
            hide-details
            class="rb-field rb-narrow"
            @update:model-value="(v) => (condition.left.output = v)"
          />
          <v-text-field
            v-for="param in paramsFor(condition.left)"
            :key="param.key"
            :model-value="condition.left.params?.[param.key]"
            :label="param.label"
            type="number"
            :min="param.min"
            :max="param.max"
            density="compact"
            variant="outlined"
            hide-details
            class="rb-field rb-tiny"
            @update:model-value="(v) => setParam(condition.left, param.key, v)"
          />
        </template>
        <v-select
          v-else-if="condition.left.type === 'price'"
          :model-value="condition.left.source ?? 'close'"
          :items="priceSources"
          density="compact"
          variant="outlined"
          hide-details
          class="rb-field rb-narrow"
          @update:model-value="(v) => (condition.left.source = v)"
        />
        <v-text-field
          v-else
          :model-value="condition.left.value"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          class="rb-field rb-narrow"
          @update:model-value="(v) => (condition.left.value = Number(v))"
        />
      </div>

      <!-- OPERATOR -->
      <v-select
        :model-value="condition.operator"
        :items="operators"
        item-title="label"
        item-value="value"
        density="compact"
        variant="outlined"
        hide-details
        class="rb-field rb-op"
        @update:model-value="(v) => setOperator(condition, v)"
      />

      <!-- RIGHT -->
      <div class="rb-operand">
        <v-select
          :model-value="condition.right.type"
          :items="operandTypes"
          item-title="label"
          item-value="value"
          density="compact"
          variant="outlined"
          hide-details
          class="rb-field rb-narrow"
          @update:model-value="(v) => setOperandType(condition, 'right', v)"
        />
        <template v-if="condition.right.type === 'indicator'">
          <v-select
            :model-value="condition.right.name"
            :items="indicatorItems"
            item-title="label"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            class="rb-field"
            @update:model-value="(v) => setIndicator(condition, 'right', v)"
          />
          <v-select
            v-if="outputsFor(condition.right).length > 1"
            :model-value="condition.right.output"
            :items="outputsFor(condition.right)"
            item-title="label"
            item-value="key"
            density="compact"
            variant="outlined"
            hide-details
            class="rb-field rb-narrow"
            @update:model-value="(v) => (condition.right.output = v)"
          />
          <v-text-field
            v-for="param in paramsFor(condition.right)"
            :key="param.key"
            :model-value="condition.right.params?.[param.key]"
            :label="param.label"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
            class="rb-field rb-tiny"
            @update:model-value="(v) => setParam(condition.right, param.key, v)"
          />
        </template>
        <v-select
          v-else-if="condition.right.type === 'price'"
          :model-value="condition.right.source ?? 'close'"
          :items="priceSources"
          density="compact"
          variant="outlined"
          hide-details
          class="rb-field rb-narrow"
          @update:model-value="(v) => (condition.right.source = v)"
        />
        <v-text-field
          v-else
          :model-value="condition.right.value"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          class="rb-field rb-narrow"
          @update:model-value="(v) => (condition.right.value = Number(v))"
        />
      </div>

      <!-- SECOND BOUND for between / outside -->
      <template v-if="needsSecondBound(condition)">
        <span class="rb-and">và</span>
        <v-text-field
          :model-value="(condition.right2 as any)?.value ?? 0"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          class="rb-field rb-narrow"
          @update:model-value="(v) => (condition.right2 = { type: 'constant', value: Number(v) })"
        />
      </template>

      <v-btn
        icon
        size="x-small"
        variant="text"
        class="rb-remove"
        @click="removeCondition(index)"
      >
        <v-icon size="18">mdi-close</v-icon>
      </v-btn>

      <p v-if="describe(condition.left)" class="rb-hint">
        {{ describe(condition.left) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type {
  Condition,
  IndicatorMeta,
  Operand,
  RuleGroup,
} from "~/composables/useTrading";

const props = defineProps<{
  modelValue: RuleGroup;
  indicators: IndicatorMeta[];
  operators: { value: string; label: string }[];
}>();
const emit = defineEmits<{ "update:modelValue": [RuleGroup] }>();

const group = computed(() => props.modelValue);

const operandTypes = [
  { value: "indicator", label: "Chỉ báo" },
  { value: "price", label: "Giá" },
  { value: "constant", label: "Số cố định" },
];
const priceSources = ["open", "high", "low", "close"];

const indicatorItems = computed(() =>
  props.indicators.map((i) => ({ value: i.name, label: i.label })),
);

const metaFor = (operand: Operand): IndicatorMeta | undefined =>
  operand.type === "indicator"
    ? props.indicators.find((i) => i.name === operand.name)
    : undefined;

const outputsFor = (operand: Operand) => metaFor(operand)?.outputs ?? [];
const paramsFor = (operand: Operand) => metaFor(operand)?.params ?? [];
const describe = (operand: Operand) => metaFor(operand)?.description ?? "";

const needsSecondBound = (condition: Condition) =>
  condition.operator === "between" || condition.operator === "outside";

const setLogic = (value: "AND" | "OR") =>
  emit("update:modelValue", { ...group.value, logic: value });

/** A fresh indicator brings its own defaults; carrying old params over is invalid. */
const defaultOperand = (type: Operand["type"]): Operand => {
  if (type === "constant") return { type: "constant", value: 0 };
  if (type === "price") return { type: "price", source: "close" };
  const first = props.indicators[0];
  return {
    type: "indicator",
    name: first?.name ?? "RSI",
    output: first?.outputs[0]?.key,
    params: Object.fromEntries((first?.params ?? []).map((p) => [p.key, p.default])),
  };
};

const addCondition = () => {
  emit("update:modelValue", {
    ...group.value,
    conditions: [
      ...group.value.conditions,
      {
        left: defaultOperand("indicator"),
        operator: "lt",
        right: { type: "constant", value: 30 },
      },
    ],
  });
};

const removeCondition = (index: number) => {
  emit("update:modelValue", {
    ...group.value,
    conditions: group.value.conditions.filter((_, i) => i !== index),
  });
};

const setOperandType = (
  condition: Condition,
  side: "left" | "right",
  type: Operand["type"],
) => {
  condition[side] = defaultOperand(type);
};

const setIndicator = (
  condition: Condition,
  side: "left" | "right",
  name: string,
) => {
  const meta = props.indicators.find((i) => i.name === name);
  condition[side] = {
    type: "indicator",
    name,
    output: meta?.outputs[0]?.key,
    params: Object.fromEntries((meta?.params ?? []).map((p) => [p.key, p.default])),
  };
};

const setParam = (operand: Operand, key: string, value: unknown) => {
  if (operand.type !== "indicator") return;
  operand.params = { ...(operand.params ?? {}), [key]: Number(value) };
};

const setOperator = (condition: Condition, value: string) => {
  condition.operator = value;
  // A range comparison is meaningless without its upper bound.
  if ((value === "between" || value === "outside") && !condition.right2) {
    condition.right2 = { type: "constant", value: 0 };
  }
};
</script>

<style scoped>
.rule-builder {
  border: 1px solid rgba(167, 139, 250, 0.15);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.4);
  padding: 14px;
}
.rb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.rb-logic {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rb-logic-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  font-weight: 700;
}
.rb-toggle :deep(.v-btn) {
  font-size: 10px;
  letter-spacing: 0.04em;
}
.rb-empty {
  font-size: 12px;
  color: #f59e0b;
  padding: 6px 0;
}
.rb-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 0;
  border-top: 1px solid rgba(167, 139, 250, 0.08);
}
.rb-index {
  min-width: 42px;
  font-size: 10px;
  font-weight: 700;
  color: #a78bfa;
  letter-spacing: 0.06em;
}
.rb-operand {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.rb-field {
  min-width: 130px;
}
.rb-narrow {
  min-width: 96px;
  max-width: 120px;
}
.rb-tiny {
  min-width: 78px;
  max-width: 92px;
}
.rb-op {
  min-width: 140px;
  max-width: 160px;
}
.rb-and {
  font-size: 11px;
  color: #64748b;
}
.rb-remove {
  color: #64748b;
}
.rb-remove:hover {
  color: #f87171;
}
.rb-hint {
  flex-basis: 100%;
  margin: 4px 0 0 42px;
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
}
</style>
