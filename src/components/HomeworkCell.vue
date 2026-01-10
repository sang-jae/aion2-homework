<!-- src/components/HomeworkCell.vue -->
<script setup lang="ts">
interface CounterCell {
  baseCurrent: number
  baseMax: number
  extraCurrent: number
  extraMax: number  // 0 이면 '제한 없음' 으로 처리
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
    <!-- 왼쪽 버튼들 (기본 남은 횟수 + / -) -->
    <div class="hw-cell-btns">
      <v-btn
        size="x-small"
        variant="outlined"
        @click="incBase(+1)"
      >
        ▲
      </v-btn>
      <v-btn
        size="x-small"
        variant="outlined"
        @click="incBase(-1)"
      >
        ▼
      </v-btn>
    </div>

    <!-- 기본 숫자 (입력 가능) -->
    <div class="hw-cell-block">
      <v-text-field
        v-model.number="props.cell.baseCurrent"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        class="hw-number"
        @blur="clampBase"
      />
      <div class="text-caption">
        / {{ props.cell.baseMax }}
      </div>
    </div>

    <!-- 추가 숫자 (입력 가능) -->
    <div class="hw-cell-block">
      <v-text-field
        v-model.number="props.cell.extraCurrent"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        class="hw-number"
        @blur="clampExtra"
      />
      <div class="text-caption">
        / {{ props.cell.extraMax > 0 ? props.cell.extraMax : '∞' }}
      </div>
    </div>

    <!-- 오른쪽 버튼들 (추가 남은 횟수 + / -) -->
    <div class="hw-cell-btns">
      <v-btn
        size="x-small"
        variant="outlined"
        @click="incExtra(+1)"
      >
        ▲
      </v-btn>
      <v-btn
        size="x-small"
        variant="outlined"
        @click="incExtra(-1)"
      >
        ▼
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.hw-cell {
  display: grid;
  grid-template-columns: auto 1fr 1fr auto;
  align-items: center;
  gap: 4px;
}

.hw-cell-btns {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hw-cell-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
  gap: 2px;
}

.hw-number :deep(input) {
  text-align: center;
  padding-inline: 4px;
}
</style>