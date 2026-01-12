<!-- src/pages/homework.vue -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import HomeworkCell from '@/components/HomeworkCell.vue'

type RowDef = {
  id: string
  label: string
  baseMax?: number
  extraMax?: number
  isSection?: boolean
}

const rowDefs: RowDef[] = [
  // 섹션: 티켓
  { id: 'section-ticket', label: '티켓', isSection: true },

  { id: 'row-ode', label: '오드', baseMax: 840, extraMax: 2000 },
  { id: 'row-expedition', label: '원정 정복', baseMax: 21, extraMax: -1 },
  { id: 'row-chowol', label: '초월', baseMax: 14, extraMax: -1 },
  { id: 'row-shugo', label: '슈고', baseMax: 14, extraMax: 30 },

  // 🔹 새 컨텐츠: 차원침공 (티켓 섹션)
  { id: 'row-dimension', label: '차원침공', baseMax: 7, extraMax: 0 },

  // 섹션: 일일
  { id: 'section-daily', label: '일일', isSection: true },

  // 🔹 새 컨텐츠: 사명퀘스트
  { id: 'row-mission', label: '사명퀘스트', baseMax: 5, extraMax: 0 },

  // 섹션: 주간
  { id: 'section-weekly', label: '주간', isSection: true },

  { id: 'row-daily', label: '일일던전', baseMax: 7, extraMax: 30 },
  { id: 'row-awaken', label: '각성전', baseMax: 3, extraMax: 30 },
  { id: 'row-boss', label: '토벌전', baseMax: 3, extraMax: 30 },
]

interface CounterCell {
  baseCurrent: number
  baseMax: number
  extraCurrent: number
  extraMax: number
}

interface HomeworkRow {
  id: string
  name: string
}

/* 🔹 캐릭터 컬럼 모드 (정복 / 초월 / 성역) */
type ColumnModeKey = 'conquest' | 'transcend' | 'sanctuary'

interface ColumnModeState {
  x2: boolean
}

interface CharacterColumn {
  id: string
  name: string
  modes: Record<ColumnModeKey, ColumnModeState>
}

function createDefaultModes(): Record<ColumnModeKey, ColumnModeState> {
  return {
    conquest: { x2: false },
    transcend: { x2: false },
    sanctuary: { x2: false },
  }
}

interface HomeworkState {
  rows: HomeworkRow[]
  columns: CharacterColumn[]
  cells: Record<string, CounterCell>
  lastAutoUpdate: string
}

const STORAGE_KEY = 'aion2-homework-state-v1'

// 기본 행/열
const defaultRows: HomeworkRow[] = [
  { id: 'row-ode',        name: '오드' },
  { id: 'row-expedition', name: '원정 정복' },
  { id: 'row-chowol',     name: '초월' },
  { id: 'row-daily',      name: '일일던전' },
  { id: 'row-awaken',     name: '각성전' },
  { id: 'row-boss',       name: '토벌전' },
  { id: 'row-shugo',      name: '슈고' },
]

const defaultColumns: CharacterColumn[] = [
  { id: 'char-1', name: '캐릭터명1', modes: createDefaultModes() },
]

// 🔹 행별 최대치 설정
const rowMaxConfig: Record<string, { baseMax: number; extraMax: number }> = {
  'row-shugo': {
    baseMax: 14,
    extraMax: 30,
  },
  'row-expedition': {
    baseMax: 21,
    extraMax: 0, // 무한
  },
  'row-ode': {
    baseMax: 840,
    extraMax: 2000,
  },
  'row-chowol': {
    baseMax: 14,
    extraMax: 0, // 무한
  },
  'row-daily': {
    baseMax: 7,
    extraMax: 30,
  },
  'row-awaken': {
    baseMax: 3,
    extraMax: 30,
  },
  'row-boss': {
    baseMax: 3,
    extraMax: 30,
  },
}

// 셀 템플릿
const defaultCell: CounterCell = {
  baseCurrent: 0,
  baseMax: 0,
  extraCurrent: 0,
  extraMax: 0,
}

// 🔹 저장본에서 modes 없을 때 보정
function ensureColumnModes(columns: CharacterColumn[]) {
  for (const col of columns as any[]) {
    const base = createDefaultModes()
    if (!col.modes) col.modes = base

    col.modes = {
      conquest: { ...base.conquest, ...(col.modes.conquest ?? {}) },
      transcend: { ...base.transcend, ...(col.modes.transcend ?? {}) },
      sanctuary: { ...base.sanctuary, ...(col.modes.sanctuary ?? {}) },
    }

    // lastAction 타입 깨진 저장본 방어
    for (const k of ['conquest', 'transcend', 'sanctuary'] as ColumnModeKey[]) {
      const a = col.modes[k].lastAction
      if (a && typeof a !== 'object') col.modes[k].lastAction = undefined
    }
  }
}

// 초기 상태 로드 (localStorage → 없으면 기본값)
function loadInitialState(): HomeworkState {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as HomeworkState
        if (parsed && parsed.rows && parsed.columns && parsed.cells) {
          ensureColumnModes(parsed.columns)
          applyMaxConfig(parsed)
          return parsed
        }
      } catch {
        // 무시하고 기본값으로
      }
    }
  }

  const cells: Record<string, CounterCell> = {}
  const base: HomeworkState = {
    rows: defaultRows,
    columns: defaultColumns,
    cells,
    lastAutoUpdate: new Date().toISOString(),
  }

  for (const row of defaultRows) {
    for (const col of defaultColumns) {
      const key = cellKey(row.id, col.id)
      base.cells[key] = { ...defaultCell }
    }
  }

  applyMaxConfig(base)
  return base
}

const state = ref<HomeworkState>(loadInitialState())

const rows = computed(() => state.value.rows)
const columns = computed(() => state.value.columns)

// cell key helpers
function cellKey(rowId: string, colId: string) {
  return `${rowId}__${colId}`
}

// 행별 최대치 적용 + 현재값 보정
function applyMaxConfig(target: HomeworkState) {
  for (const row of target.rows) {
    const config = rowMaxConfig[row.id]
    for (const col of target.columns) {
      const key = cellKey(row.id, col.id)
      const cell =
        target.cells[key] ?? (target.cells[key] = { ...defaultCell })

      if (config) {
        cell.baseMax = config.baseMax
        cell.extraMax = config.extraMax
      }

      if (cell.baseCurrent < 0) cell.baseCurrent = 0
      if (cell.extraCurrent < 0) cell.extraCurrent = 0
      if (cell.baseMax > 0 && cell.baseCurrent > cell.baseMax) {
        cell.baseCurrent = cell.baseMax
      }
      if (cell.extraMax > 0 && cell.extraCurrent > cell.extraMax) {
        cell.extraCurrent = cell.extraMax
      }
    }
  }
}

function getRowDef(rowId: string) {
  return rowDefs.find(r => r.id === rowId)
}

function getCell(rowId: string, colId: string) {
  const key = `${rowId}__${colId}`
  let cell = state.value.cells[key]
  const rowDef = getRowDef(rowId)

  if (!cell) {
    cell = {
      baseCurrent: 0,
      baseMax: rowDef?.baseMax ?? 0,
      extraCurrent: 0,
      extraMax: rowDef?.extraMax ?? 0,
    }
    state.value.cells[key] = cell
  } else if (rowDef) {
    if (typeof rowDef.baseMax === 'number') {
      cell.baseMax = rowDef.baseMax
      if (cell.baseCurrent > cell.baseMax) {
        cell.baseCurrent = cell.baseMax
      }
    }
    if (typeof rowDef.extraMax === 'number') {
      cell.extraMax = rowDef.extraMax
      if (cell.extraMax > 0 && cell.extraCurrent > cell.extraMax) {
        cell.extraCurrent = cell.extraMax
      }
    }
  }

  return cell
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min
  if (value > max) return max
  return value
}

function isInfiniteExtra(cell: CounterCell) {
  return cell.extraMax < 0
}

function hasExtraBucket(cell: CounterCell) {
  // extraMax === 0 이면 "추가 자체 없음"으로 취급
  return cell.extraMax !== 0
}

function planDeduct(cell: CounterCell, amount: number): { base: number; extra: number } | null {
  if (amount <= 0) return { base: 0, extra: 0 }

  const baseAvail = Math.max(0, cell.baseCurrent)
  const extraAvail = hasExtraBucket(cell) ? Math.max(0, cell.extraCurrent) : 0
  const total = baseAvail + extraAvail

  if (total < amount) return null

  const baseUse = Math.min(baseAvail, amount)
  const extraUse = amount - baseUse
  return { base: baseUse, extra: extraUse }
}

function applyDeduct(cell: CounterCell, d: { base: number; extra: number }) {
  cell.baseCurrent = Math.max(0, cell.baseCurrent - d.base)
  if (hasExtraBucket(cell)) {
    cell.extraCurrent = Math.max(0, cell.extraCurrent - d.extra)
  }
}

function applyAdd(cell: CounterCell, d: { base: number; extra: number }) {
  // base는 max 있으면 clamp
  if (cell.baseMax > 0) {
    cell.baseCurrent = Math.min(cell.baseMax, cell.baseCurrent + d.base)
  } else {
    cell.baseCurrent = cell.baseCurrent + d.base
  }

  // extra
  if (hasExtraBucket(cell)) {
    if (isInfiniteExtra(cell)) {
      cell.extraCurrent = cell.extraCurrent + d.extra
    } else if (cell.extraMax > 0) {
      cell.extraCurrent = Math.min(cell.extraMax, cell.extraCurrent + d.extra)
    } else {
      // extraMax === 0이면 bucket 자체 없음(무시)
    }
  }
}

function getCol(colId: string) {
  return state.value.columns.find(c => c.id === colId)
}

function doConquest(colId: string) {
  const col = getCol(colId)
  if (!col) return

  const x2 = !!col.modes.conquest.x2
  const odeCost = x2 ? 80 : 40

  const ticketCell = getCell('row-expedition', colId)
  const odeCell = getCell('row-ode', colId)

  const ticketDeduct = planDeduct(ticketCell, 1)
  if (!ticketDeduct) {
    window.alert('정복 티켓이 부족하여 완료 체크를 할 수 없습니다.')
    return
  }

  const odeDeduct = planDeduct(odeCell, odeCost)
  if (!odeDeduct) {
    window.alert('오드가 부족하여 완료 체크를 할 수 없습니다.')
    return
  }

  // 둘 다 가능할 때만 실제 차감
  applyDeduct(ticketCell, ticketDeduct)
  applyDeduct(odeCell, odeDeduct)

  col.modes.conquest.lastAction = {
    ticket: { rowId: 'row-expedition', ...ticketDeduct },
    ode: { rowId: 'row-ode', ...odeDeduct },
    at: new Date().toISOString(),
  }
}

function doTranscend(colId: string) {
  const col = getCol(colId)
  if (!col) return

  const x2 = !!col.modes.transcend.x2
  const odeCost = x2 ? 80 : 40

  const ticketCell = getCell('row-chowol', colId)
  const odeCell = getCell('row-ode', colId)

  const ticketDeduct = planDeduct(ticketCell, 1)
  if (!ticketDeduct) {
    window.alert('초월 티켓이 부족하여 완료 체크를 할 수 없습니다.')
    return
  }

  const odeDeduct = planDeduct(odeCell, odeCost)
  if (!odeDeduct) {
    window.alert('오드가 부족하여 완료 체크를 할 수 없습니다.')
    return
  }

  applyDeduct(ticketCell, ticketDeduct)
  applyDeduct(odeCell, odeDeduct)

  col.modes.transcend.lastAction = {
    ticket: { rowId: 'row-chowol', ...ticketDeduct },
    ode: { rowId: 'row-ode', ...odeDeduct },
    at: new Date().toISOString(),
  }
}

function doSanctuary(colId: string) {
  const col = getCol(colId)
  if (!col) return

  const odeCost = 40 // 성역은 요구사항상 항상 40

  const odeCell = getCell('row-ode', colId)
  const odeDeduct = planDeduct(odeCell, odeCost)

  if (!odeDeduct) {
    window.alert('오드가 부족하여 완료 체크를 할 수 없습니다.')
    return
  }

  applyDeduct(odeCell, odeDeduct)

  col.modes.sanctuary.lastAction = {
    ode: { rowId: 'row-ode', ...odeDeduct },
    at: new Date().toISOString(),
  }
}

function undoMode(colId: string, mode: ColumnModeKey) {
  const col = getCol(colId)
  if (!col) return

  const action = col.modes[mode].lastAction
  if (!action) return

  // ticket 복원
  if (action.ticket) {
    const cell = getCell(action.ticket.rowId, colId)
    applyAdd(cell, { base: action.ticket.base, extra: action.ticket.extra })
  }

  // ode 복원
  if (action.ode) {
    const cell = getCell(action.ode.rowId, colId)
    applyAdd(cell, { base: action.ode.base, extra: action.ode.extra })
  }

  col.modes[mode].lastAction = undefined
}

// 버튼 동작들
function changeBase(rowId: string, colId: string, delta: number) {
  const cell = getCell(rowId, colId)
  const next = cell.baseCurrent + delta
  cell.baseCurrent = clamp(next, 0, cell.baseMax)
}

function changeExtra(rowId: string, colId: string, delta: number) {
  const cell = getCell(rowId, colId)
  const next = cell.extraCurrent + delta
  cell.extraCurrent = clamp(next, 0, cell.extraMax)
}

// 행 추가
function addRow() {
  const name = window.prompt('추가할 숙제 이름을 입력하세요.')
  if (!name) return
  const trimmed = name.trim()
  if (!trimmed) return

  const id = `row-${Date.now()}`
  state.value.rows.push({ id, name: trimmed })

  for (const col of state.value.columns) {
    getCell(id, col.id)
  }
}

// 열(캐릭터) 추가용 다이얼로그
const addColumnDialog = ref(false)
const newCharacterName = ref('')

function openAddColumn() {
  newCharacterName.value = ''
  addColumnDialog.value = true
}

// 열(캐릭터) 추가
function confirmAddColumn() {
  const name = newCharacterName.value.trim()
  if (!name) return

  const id = `char-${Date.now()}`
  state.value.columns.push({ id, name, modes: createDefaultModes() })

  for (const row of state.value.rows) {
    getCell(row.id, id)
  }

  addColumnDialog.value = false
}

// localStorage 저장
watch(
  state,
  (val) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    }
  },
  { deep: true }
)

// 자동 증가용 타이머
let timerId: number | undefined

onMounted(() => {
  handleAutoIncrease()
  timerId = window.setInterval(handleAutoIncrease, 60_000)
})

onBeforeUnmount(() => {
  if (timerId) {
    window.clearInterval(timerId)
  }
})

const draggingColumnId = ref<string | null>(null)
const dropPreview = ref<{ targetId: string; position: 'before' | 'after' } | null>(null)

function onColumnDragStart(colId: string, event: DragEvent) {
  draggingColumnId.value = colId
  dropPreview.value = null

  event.dataTransfer?.setData('text/plain', colId)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onColumnDragOver(colId: string, event: DragEvent) {
  event.preventDefault()
  if (!draggingColumnId.value || draggingColumnId.value === colId) {
    dropPreview.value = null
    return
  }

  const target = event.currentTarget as HTMLElement | null
  let position: 'before' | 'after' = 'after'

  if (target) {
    const rect = target.getBoundingClientRect()
    const x = event.clientX - rect.left
    position = x < rect.width / 2 ? 'before' : 'after'
  }

  dropPreview.value = { targetId: colId, position }

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onColumnDrop(colId: string, event: DragEvent) {
  event.preventDefault()

  const fromId = draggingColumnId.value
  const preview = dropPreview.value
  draggingColumnId.value = null
  dropPreview.value = null

  if (!fromId) return

  const cols = state.value.columns
  const fromIndex = cols.findIndex((c) => c.id === fromId)
  let toIndex = cols.findIndex((c) => c.id === colId)

  if (fromIndex === -1 || toIndex === -1) return
  if (fromIndex === toIndex && !preview) return

  if (preview && preview.targetId === colId) {
    if (preview.position === 'after') {
      toIndex += 1
    }
  } else {
    toIndex += 1
  }

  const [moved] = cols.splice(fromIndex, 1)
  if (fromIndex < toIndex) {
    toIndex -= 1
  }
  cols.splice(toIndex, 0, moved)
}

function onColumnDragEnd() {
  draggingColumnId.value = null
  dropPreview.value = null
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

function makeAnchorAtHour(hour: number) {
  const d = new Date(0)
  d.setHours(hour, 0, 0, 0)
  return d
}

const ANCHOR_5 = makeAnchorAtHour(5)

const ANCHOR_WED_5 = (() => {
  const d = makeAnchorAtHour(5)
  while (d.getDay() !== 3) {
    d.setDate(d.getDate() + 1)
  }
  return d
})()

function countPeriodicEvents(
  last: Date,
  now: Date,
  anchor: Date,
  periodMs: number
): number {
  const lastMs = last.getTime()
  const nowMs = now.getTime()
  if (nowMs <= lastMs) return 0

  const baseMs = anchor.getTime()
  const fromIndex = Math.floor((lastMs - baseMs) / periodMs)
  const toIndex = Math.floor((nowMs - baseMs) / periodMs)

  return Math.max(0, toIndex - fromIndex)
}

function addBaseToRow(rowId: string, amount: number) {
  if (amount <= 0) return
  for (const col of state.value.columns) {
    const cell = getCell(rowId, col.id)
    const max = cell.baseMax
    if (max > 0) {
      cell.baseCurrent = Math.min(max, cell.baseCurrent + amount)
    } else {
      cell.baseCurrent += amount
    }
  }
}

function setBaseToMax(rowId: string) {
  for (const col of state.value.columns) {
    const cell = getCell(rowId, col.id)
    const max = cell.baseMax
    if (max > 0) {
      cell.baseCurrent = max
    }
  }
}

function handleAutoIncrease() {
  const now = new Date()

  let last = new Date(state.value.lastAutoUpdate || now.toISOString())
  if (isNaN(last.getTime())) {
    last = now
  }

  if (now.getTime() <= last.getTime()) {
    state.value.lastAutoUpdate = now.toISOString()
    return
  }

  const expeditionEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_5,
    8 * HOUR_MS
  )
  if (expeditionEvents > 0) {
    addBaseToRow('row-expedition', expeditionEvents * 1)
  }

  const odeEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_5,
    3 * HOUR_MS
  )
  if (odeEvents > 0) {
    addBaseToRow('row-ode', odeEvents * 15)
  }

  const chowolEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_5,
    12 * HOUR_MS
  )
  if (chowolEvents > 0) {
    addBaseToRow('row-chowol', chowolEvents * 1)
  }

  const shugoEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_5,
    DAY_MS
  )
  if (shugoEvents > 0) {
    addBaseToRow('row-shugo', shugoEvents * 2)
  }

  const weeklyEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_WED_5,
    WEEK_MS
  )
  if (weeklyEvents > 0) {
    setBaseToMax('row-daily')
    setBaseToMax('row-awaken')
    setBaseToMax('row-boss')
  }

  // 차원침공 : 매일 5시, +1
  const dimensionEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_5,
    DAY_MS
  )
  if (dimensionEvents > 0) {
    addBaseToRow('row-dimension', dimensionEvents * 1)
  }

  // 사명퀘스트 : 매일 5시, baseMax(5) 까지
  const missionEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_5,
    DAY_MS
  )
  if (missionEvents > 0) {
    setBaseToMax('row-mission')
  }

  state.value.lastAutoUpdate = now.toISOString()


}


// 버튼 동작 추가
interface ColumnDeductLog {
  rowId: string
  base: number
  extra: number
}

interface ColumnModeAction {
  ticket?: ColumnDeductLog
  ode?: ColumnDeductLog
  at: string
}

interface ColumnModeState {
  x2: boolean
  lastAction?: ColumnModeAction
}






// watch(
//   () => state.value.columns,
//   (newCols, oldCols) => {
//     console.log('📌 columns changed')
//     console.log('old:', oldCols)
//     console.log('new:', newCols)
//   },
//   { deep: true }
// )

</script>

<template>
  <v-container class="py-8" fluid>
    <h1 class="text-h4 mb-2 font-weight-bold">숙제표 체크리스트</h1>
    <p class="text-body-2 mb-6 opacity-70">
      캐릭터별 숙제 현황을 기록하는 표입니다. 값은 브라우저에 저장되며 새로고침해도 유지됩니다.
    </p>

    <v-card class="hw-card" elevation="3">
      <v-card-title class="d-flex align-center justify-space-between">
        <div class="text-subtitle-1 font-weight-medium">
          일일 / 주간 숙제 관리
        </div>
        <div class="d-flex hw-actions">
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            @click="openAddColumn"
          >
            + 캐릭터 추가
          </v-btn>
        </div>
      </v-card-title>

      <v-divider />

      <v-card-text class="pa-0">
        <div class="hw-table-wrapper">
          <v-table class="hw-table" density="comfortable">
            <thead>
              <tr>
                <th class="hw-first-col text-left text-caption text-uppercase">
                  컨텐츠
                </th>

                <th
                  v-for="col in columns"
                  :key="col.id"
                  class="text-center hw-col-header"
                  @dragover="(e) => onColumnDragOver(col.id, e)"
                  @drop="(e) => onColumnDrop(col.id, e)"
                  @dragend="onColumnDragEnd"
                  :class="{
                    'hw-drop-before':
                      dropPreview && dropPreview.targetId === col.id && dropPreview.position === 'before',
                    'hw-drop-after':
                      dropPreview && dropPreview.targetId === col.id && dropPreview.position === 'after',
                  }"
                >
                  <div class="hw-col-header-inner">
                    <div
                      class="hw-col-handle-bar"
                      draggable="true"
                      @dragstart="(e) => onColumnDragStart(col.id, e)"
                    >
                      <span class="hw-col-dots">⋯</span>
                    </div>
                    <div class="hw-col-header-content">
                      
                      <v-text-field
                        v-model="col.name"
                        variant="underlined"
                        density="compact"
                        hide-details
                        class="hw-header-input"
                        placeholder="캐릭터명"
                      />

                      <!-- 🔹 정복 / 초월 / 성역 모드 줄 -->
                      <div class="hw-mode-row">
                        <!-- 정복 -->
                        <div class="hw-mode-card" @click="doConquest(col.id)">
                          <!-- 왼쪽: 라벨 -->
                          <div class="hw-mode-left">
                            <span class="hw-mode-label">정복</span>
                          </div>

                          <!-- 오른쪽: X2 + undo -->
                          <div class="hw-mode-right">
                            <label class="hw-x2" @mousedown.stop @click.stop @touchstart.stop>
                              <input type="checkbox" v-model="col.modes.conquest.x2" />
                              <span class="hw-x2-box" aria-hidden="true"></span>
                              <span class="hw-x2-text">x2</span>
                            </label>

                            <v-btn
                              class="hw-undo-btn"
                              icon
                              size="x-small"
                              variant="flat"
                              @click.stop="undoMode(col.id, 'conquest')"
                            >
                              ↶
                            </v-btn>
                          </div>
                        </div>

                        <!-- 초월 -->
                        <div class="hw-mode-card" @click="doTranscend(col.id)">
                          <!-- 왼쪽: 라벨 -->
                          <div class="hw-mode-left">
                            <span class="hw-mode-label">초월</span>
                          </div>

                          <!-- 오른쪽: X2 + undo -->
                          <div class="hw-mode-right">
                            <label class="hw-x2" @mousedown.stop @click.stop @touchstart.stop>
                              <input type="checkbox" v-model="col.modes.transcend.x2" />
                              <span class="hw-x2-box" aria-hidden="true"></span>
                              <span class="hw-x2-text">x2</span>
                            </label>

                            <v-btn
                              class="hw-undo-btn"
                              icon
                              size="x-small"
                              variant="flat"
                              @click.stop="undoMode(col.id, 'transcend')"
                            >
                              ↶
                            </v-btn>
                          </div>
                        </div>

                        <!-- 성역 -->
                        <div class="hw-mode-card" @click="doSanctuary(col.id)">
                          <!-- 왼쪽: 라벨 -->
                          <div class="hw-mode-left">
                            <span class="hw-mode-label">성역</span>
                          </div>

                          <!-- 오른쪽: X2 + undo -->
                          <div class="hw-mode-right hw-sanctuary-check">
                            <!-- <label class="hw-x2" @mousedown.stop @click.stop @touchstart.stop>
                              <input type="checkbox" v-model="col.modes.sanctuary.x2" />
                              <span class="hw-x2-box" aria-hidden="true"></span>
                              <span class="hw-x2-text">x2</span>
                            </label> -->

                            <v-btn
                              class="hw-undo-btn"
                              icon
                              size="x-small"
                              variant="flat"
                              @click.stop="undoMode(col.id, 'sanctuary')"
                            >
                              ↶
                            </v-btn>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              <template v-for="row in rowDefs" :key="row.id">
                <!-- 섹션 헤더 -->
                <tr v-if="row.isSection" class="hw-section-row">
                  <td
                    class="hw-section-cell"
                    :colspan="columns.length + 1"
                  >
                    {{ row.label }}
                  </td>
                </tr>

                <!-- 실제 컨텐츠 행 -->
                <tr v-else class="hw-row">
                  <td class="hw-first-col">
                    {{ row.label }}
                  </td>

                  <td
                    v-for="col in columns"
                    :key="col.id"
                  >
                    <HomeworkCell :cell="getCell(row.id, col.id)" />
                  </td>
                </tr>
              </template>
            </tbody>
          </v-table>
        </div>
      </v-card-text>
    </v-card>

    <!-- 캐릭터 추가 다이얼로그 -->
    <v-dialog v-model="addColumnDialog" max-width="400">
      <v-card>
        <v-card-title>캐릭터 추가</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newCharacterName"
            label="캐릭터명"
            autofocus
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="addColumnDialog = false">
            취소
          </v-btn>
          <v-btn color="primary" @click="confirmAddColumn">
            확인
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.hw-card {
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hw-table-wrapper {
  overflow-x: auto;
}

.hw-table :deep(th),
.hw-table :deep(td) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.hw-table :deep(thead tr) {
  background-color: rgba(255, 255, 255, 0.03);
}

.hw-first-col {
  min-width: 150px;
}

.hw-col-header {
  position: relative;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

.hw-col-header-inner {
  display: flex;
  flex-direction: column;
}

/* 드래그 핸들 바 */
.hw-col-handle-bar {
  width: 100%;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.15);
  cursor: grab;
  user-select: none;
  border-radius: 0px;
  transition: background-color 0.15s, opacity 0.15s;
  opacity: 0.9;
  box-sizing: border-box;
}

.hw-col-handle-bar:hover {
  background-color: rgba(255, 255, 255, 0.25);
  opacity: 1;
}

.hw-col-handle-bar:active {
  cursor: grabbing;
  background-color: rgba(255, 255, 255, 0.32);
}

.hw-col-dots {
  font-size: 16px;
  letter-spacing: 2px;
}

.hw-col-header.hw-drop-before::before,
.hw-col-header.hw-drop-after::after {
  content: '';
  position: absolute;
  top: 2px;
  bottom: 2px;
  width: 3px;
  border-radius: 999px;
  background-color: rgb(144, 202, 249);
}

.hw-col-header.hw-drop-before::before {
  left: -2px;
}

.hw-col-header.hw-drop-after::after {
  right: -2px;
}

.hw-header-input :deep(input) {
  text-align: center;
  font-size: 13px;
}

.hw-row-input :deep(input) {
  font-weight: 600;
  font-size: 13px;
}

.opacity-70 {
  opacity: 0.7;
}

/* actions gap */
.hw-actions > * + * {
  margin-left: 8px;
}

.hw-section-row {
  background-color: rgba(255, 255, 255, 0.03);
}

.hw-section-cell {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

/* 🔹 정복 / 초월 / 성역 UI */


.hw-mode-top {
  display: flex;
  justify-content: flex-end;
}

.hw-mode-x2-wrap {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Vuetify 체크박스 여백 줄이기 */
.hw-mode-checkbox :deep(.v-selection-control) {
  padding: 0;
  margin: 0;
}
.hw-mode-checkbox :deep(.v-icon) {
  font-size: 16px;
}

.hw-mode-x2-label {
  font-size: 11px;
  color: #7fb5ff;
}

.hw-mode-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.hw-mode-undo {
  min-width: 0;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  color: #9fd3ff;
}

/* ✅ 드래그바 아래 내용만 좌우 여백 주기 */
.hw-col-header-content {
  padding: 0 10px 8px;   /* 여기 값이 아래 td랑 폭 느낌 맞춰줌 */
}

/* 3개 카드 한 줄 */
.hw-mode-row {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

/* 카드 자체: 좌/우 분할 */

.hw-mode-card {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr 64px; /* 오른쪽 폭 고정(체크+undo) */
  align-items: stretch;

  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.10);
  overflow: hidden;
}

/* 왼쪽 라벨 영역 */
.hw-mode-left {
  display: flex;
  align-items: center;
  padding: 10px 10px;
}

.hw-mode-label {
  font-size: 20px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 0.02em;
}

/* 오른쪽 영역: 구분선 + 위아래 배치 */
.hw-mode-right {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 13px 13px;
}

/* X2 체크 영역 */
.hw-x2 {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  margin-bottom: 10px;
}

/* 실제 input 숨기고 커스텀 박스 */
.hw-x2 input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

/* 체크박스 테두리(구분 확실히) */
.hw-x2-box {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid rgba(255, 255, 255, 0.55);
  background: rgba(0, 0, 0, 0.15);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.35);
  display: inline-block;
}

/* 체크된 상태 표시 */
.hw-x2 input:checked + .hw-x2-box {
  border-color: rgba(144, 202, 249, 0.95);
  background: rgba(144, 202, 249, 0.25);
  box-shadow: inset 0 0 0 2px rgba(144, 202, 249, 0.35);
}

/* x2 텍스트 */
.hw-x2-text {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: rgba(255, 255, 255, 0.88);
  text-transform: uppercase;
}

/* 되돌리기 원형 버튼 - “버튼처럼” 보이게 */
.hw-undo-btn {
  align-self: flex-end;
  width: 32px;
  height: 32px;
  border-radius: 999px !important;
  font-size: 18px;

  background: rgba(255, 255, 255, 0.12) !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  color: white !important;

  padding-top: 3px;
}

.hw-undo-btn:hover {
  background: rgba(255, 255, 255, 0.18) !important;
}

.hw-sanctuary-check {
  margin:auto;
}
</style>