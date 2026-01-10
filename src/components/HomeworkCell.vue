<script setup lang="ts">
interface CounterCell {
  baseCurrent: number
  baseMax: number
  extraCurrent: number
  extraMax: number
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
    <!-- 기본 -->
    <div class="hw-counter hw-base">
      <div class="hw-body">
        <v-btn
          size="x-small"
          variant="text"
          class="hw-arrow"
          @click="incBase(-1)"
        >
          ▼
        </v-btn>

        <div class="hw-inline">
          <input
            class="hw-num hw-num-base"
            type="number"
            v-model.number="props.cell.baseCurrent"
            @blur="clampBase"
          />
          <span class="hw-max hw-max-base">
            / {{ props.cell.baseMax }}
          </span>
        </div>

        <v-btn
          size="x-small"
          variant="text"
          class="hw-arrow"
          @click="incBase(+1)"
        >
          ▲
        </v-btn>
      </div>
    </div>

    <!-- 추가 -->
    <div class="hw-counter hw-extra">
      <div class="hw-body">
        <v-btn
          size="x-small"
          variant="text"
          class="hw-arrow"
          @click="incExtra(-1)"
        >
          ▼
        </v-btn>

        <div class="hw-inline">
          <input
            class="hw-num hw-num-extra"
            type="number"
            v-model.number="props.cell.extraCurrent"
            @blur="clampExtra"
          />
          <span class="hw-max hw-max-extra">
            / {{ props.cell.extraMax > 0 ? props.cell.extraMax : '∞' }}
          </span>
        </div>

        <v-btn
          size="x-small"
          variant="text"
          class="hw-arrow"
          @click="incExtra(+1)"
        >
          ▲
        </v-btn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hw-cell {
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hw-counter {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hw-body {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 4px;
}

.hw-inline {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

/* 숫자 input 공통 스타일 */
.hw-num {
  width: 50px;
  background: transparent;
  border: none;
  outline: none;
  text-align: right;
  font-weight: 700;
  font-size: 26px; /* 기존보다 크게 */
  padding: 0;
  margin: 0;
  -moz-appearance: textfield;
}

/* 크롬/엣지 number 스피너 제거 */
.hw-num::-webkit-outer-spin-button,
.hw-num::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* 기본 = 흰색 */
.hw-num-base {
  color: #ffffff;
}

/* 추가 = 파란색 */
.hw-num-extra {
  color: #7fb5ff;
}

/* /max 텍스트 */
.hw-max {
  font-size: 18px;
  font-weight: 500;
}

/* Max 색상 구분 */
.hw-max-base {
  color: #ffffff;
  opacity: 0.8;
}

.hw-max-extra {
  color: #7fb5ff;
  opacity: 0.8;
}

/* 화살표 버튼 */
.hw-arrow {
  min-width: 24px;
  padding: 0;
  line-height: 1;
}

.hw-base .hw-arrow {
  color: #ffffff;
}
.hw-extra .hw-arrow {
  color: #7fb5ff;
}
</style>