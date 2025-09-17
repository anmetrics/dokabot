<script lang="ts" setup>
const props = defineProps<{
  step?: number | string;
  min?: string;
  max?: string;
  modelValue?: string | null | undefined;
}>()
const emit = defineEmits(['update:modelValue'])

const timeSearchParam = ref<string>('')
const vModel = computed({
  get: () => props.modelValue || null,
  set: value => emit('update:modelValue', value)
})
const hoursInDay = computed(() => generateHoursInDay(Number(props.step) || 30))
function matchHourAndMinutes (time: string) {
  return time.match(/^(\d{2}):(\d{2})$/)
}
function generateHoursInDay (step: number) {
  let hoursInDay: string[] = []
  let startMinutes = 0
  let endMinutes = 24 * 60
  if (props.min) {
    const [, hour, minutes] = matchHourAndMinutes(props.min) || [
      '',
      '00',
      '00'
    ]
    startMinutes = Number(hour) * 60 + step * Math.ceil(Number(minutes) / step)
  }
  if (props.max) {
    const [, hour, minutes] = matchHourAndMinutes(props.max) || [
      '',
      '24',
      '00'
    ]
    endMinutes = Number(hour) * 60 + step * Math.ceil(Number(minutes) / step)
  }
  for (startMinutes; startMinutes <= endMinutes; startMinutes += step) {
    const hour = Math.floor(startMinutes / 60).toString()
    const minute = (startMinutes % 60).toString()
    const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    hoursInDay = [...hoursInDay, time]
  }
  return hoursInDay
}

function handleInput () {
  const timePicker = formatTimePicker(timeSearchParam.value)
  if (hoursInDay.value.includes(timePicker)) {
    vModel.value = timePicker
  }
}

function formatTimePicker (time: string) {
  if (time.trim().length === 4) {
    return `0${time}`
  }

  return time
}
</script>
<template>
  <v-autocomplete
    v-model="vModel"
    v-model:search="timeSearchParam"
    v-bind="$attrs"
    class="doka-time-picker"
    label="time picker"
    :items="hoursInDay"
    @update:search="handleInput"
  >
    <template #no-data>
      <p v-if="timeSearchParam" class="nodata">
        該当する情報が見つかりません
      </p>
    </template>
  </v-autocomplete>
</template>
<style lang="scss" scoped></style>
