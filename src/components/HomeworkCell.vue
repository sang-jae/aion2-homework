<!-- src/components/HomeworkCell.vue -->
<script setup lang="ts">
interface CounterCell {
  baseCurrent: number
  baseMax: number
  extraCurrent: number
  extraMax: number // 0이면 제한 없음
}

const props = defineProps<{
  cell: CounterCell
}>()

function clampBase() {
  const max = props.cell.baseMax
  if (props.cell.baseCurrent < 0) props.cell.baseCurrent = 0
  if (max > 0 && props.cell.baseCurrent > max) {
    props.cell.baseCurrent = max
  }
}

function clampExtra() {
  const max = props.cell.extraMax
  if (props.cell.extraCurrent < 0) props.cell.extraCurrent = 0
  if (max > 0 && props.cell.extraCurrent > max) {
    props.cell.extraCurrent = max
  }
}

function incBase(delta: number) {
  props.cell.baseCurrent += delta
  clampBase()
}

function incExtra(delta: number) {
  props.cell.extraCurrent += delta
  clampExtra()
}
</script>

<template>
  <div class="hw-cell">
    <!-- 기본 카운트 -->
    <div class="hw-counter">
      <div class="hw-counter-header">기본</div>

      <div class="hw-counter-body">
        <v-btn
          icon
          size="x-small"
          variant="text"
          class="hw-arrow"
          @click="incBase(+1)"
        >
          <v-icon icon="mdi-chevron-up" size="16" />
        </v-btn>

        <v-text-field
          v-model.number="props.cell.baseCurrent"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          class="hw-number"
          @blur="clampBase"
        />

        <v-btn
          icon
          size="x-small"
          variant="text"
          class="hw-arrow"
          @click="incBase(-1)"
        >
          <v-icon icon="mdi-chevron-down" size="16" />
        </v-btn>
      </div>

      <div class="hw-max">
        / {{ props.cell.baseMax }}
      </div>
    </div>

    <!-- 추가 카운트 -->
    <div class="hw-counter">
      <div class="hw-counter-header">추가</div>

      <div class="hw-counter-body">
        <v-btn
          icon
          size="x-small"
          variant="text"
          class="hw-arrow"
          @click="incExtra(+1)"
        >
          <v-icon icon="mdi-chevron-up" size="16" />
        </v-btn>

        <v-text-field
          v-model.number="props.cell.extraCurrent"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          class="hw-number"
          @blur="clampExtra"
        />

        <v-btn
          icon
          size="x-small"
          variant="text"
          variant="text"
          class="hw-arrow"
          @click="incExtra(-1)"
        >
          <v-icon icon="mdi-chevron-down" size="16" />
        </v-btn>
      </div>

      <div class="hw-max">
        / {{ props.cell.extraMax > 0 ? props.cell.extraMax : '∞' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.hw-cell {
  display: flex;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 10px;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.hw-counter {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hw-counter-header {
  font-size: 11px;
  opacity: 0.7;
}

.hw-counter-body {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 4px;
}

.hw-number :deep(input) {
  text-align: center;
  padding-inline: 4px;
  font-size: 13px;
}

.hw-max {
  font-size: 11px;
  text-align: right;
  opacity: 0.7;
}

.hw-arrow {
  min-width: 0;
}
</style>