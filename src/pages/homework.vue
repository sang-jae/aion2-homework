<!-- src/pages/homework.vue -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import HomeworkCell from '@/components/HomeworkCell.vue'

/** =========================
 *  RowDefs (전체 컨텐츠 마스터)
 *  ========================= */

type SectionKey = 'ticket' | 'daily' | 'weekly'

type RowDef = {
  id: string
  label: string
  baseMax?: number
  extraMax?: number
  isSection?: boolean
  sectionKey?: SectionKey
}

const rowDefs: RowDef[] = [
  // 섹션: 티켓
  { id: 'section-ticket', label: '티켓', isSection: true, sectionKey: 'ticket' },

  { id: 'row-ode', label: '오드', baseMax: 840, extraMax: 2000, sectionKey: 'ticket' },
  { id: 'row-expedition', label: '원정 정복', baseMax: 21, extraMax: -1, sectionKey: 'ticket' },
  { id: 'row-chowol', label: '초월', baseMax: 14, extraMax: -1, sectionKey: 'ticket' },
  { id: 'row-shugo', label: '슈고', baseMax: 14, extraMax: 30, sectionKey: 'ticket' },
  { id: 'row-dimension', label: '차원침공', baseMax: 7, extraMax: 0, sectionKey: 'ticket' },

  // 섹션: 일일
  { id: 'section-daily', label: '일일', isSection: true, sectionKey: 'daily' },

  { id: 'row-mission', label: '사명퀘스트', baseMax: 5, extraMax: 0, sectionKey: 'daily' },

  // 섹션: 주간
  { id: 'section-weekly', label: '주간', isSection: true, sectionKey: 'weekly' },

  { id: 'row-daily', label: '일일던전', baseMax: 7, extraMax: 30, sectionKey: 'weekly' },
  { id: 'row-awaken', label: '각성전', baseMax: 3, extraMax: 30, sectionKey: 'weekly' },
  { id: 'row-boss', label: '토벌전', baseMax: 3, extraMax: 30, sectionKey: 'weekly' },
]

function getRowDefById(id: string) {
  return rowDefs.find(r => r.id === id)
}

/** =========================
 *  Types
 *  ========================= */

interface CounterCell {
  baseCurrent: number
  baseMax: number
  extraCurrent: number
  extraMax: number
}

type ColumnModeKey = 'conquest' | 'transcend' | 'sanctuary'

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

interface CharacterColumn {
  id: string
  name: string
  modes: Record<ColumnModeKey, ColumnModeState>
}

interface HomeworkState {
  columns: CharacterColumn[]
  cells: Record<string, CounterCell>
  lastAutoUpdate: string
  membership: boolean
  activeRowIds: string[] // ✅ 활성 컨텐츠 + 순서
}

/** =========================
 *  Defaults / Keys
 *  ========================= */

const STORAGE_KEY = 'aion2-homework-state-v2'

const defaultColumns: CharacterColumn[] = [
  { id: 'char-1', name: '캐릭터명1', modes: createDefaultModes() },
]

const defaultActiveRowIds = [
  'row-ode',
  'row-expedition',
  'row-chowol',
  'row-shugo',
  'row-dimension',
  'row-mission',
  'row-daily',
  'row-awaken',
  'row-boss',
]

const defaultCell: CounterCell = {
  baseCurrent: 0,
  baseMax: 0,
  extraCurrent: 0,
  extraMax: 0,
}

function cellKey(rowId: string, colId: string) {
  return `${rowId}__${colId}`
}

function createDefaultModes(): Record<ColumnModeKey, ColumnModeState> {
  return {
    conquest: { x2: false },
    transcend: { x2: false },
    sanctuary: { x2: false },
  }
}

/** =========================
 *  Row max config (★ TDZ 방지: loadInitialState보다 위에 있어야 함)
 *  =========================
 *  extraMax 규칙:
 *  - extraMax < 0 : 무한
 *  - extraMax = 0 : 추가 bucket 없음
 *  - extraMax > 0 : 제한 있음
 */
const rowMaxConfig: Record<string, { baseMax: number; extraMax: number }> = {
  'row-shugo': { baseMax: 14, extraMax: 30 },
  'row-expedition': { baseMax: 21, extraMax: 0 }, // extra 없음으로 취급
  'row-ode': { baseMax: 840, extraMax: 2000 },
  'row-chowol': { baseMax: 14, extraMax: 0 }, // extra 없음으로 취급
  'row-daily': { baseMax: 7, extraMax: 30 },
  'row-awaken': { baseMax: 3, extraMax: 30 },
  'row-boss': { baseMax: 3, extraMax: 30 },
  'row-dimension': { baseMax: 7, extraMax: 0 },
  'row-mission': { baseMax: 5, extraMax: 0 },
}

// 행별 최대치 적용 + 현재값 보정
function applyMaxConfig(target: HomeworkState) {
  // 마스터 컨텐츠 기준으로 모두 보정해둠(비활성도 셀 유지)
  for (const row of rowDefs.filter(r => !r.isSection)) {
    const cfg = rowMaxConfig[row.id] ?? {
      baseMax: row.baseMax ?? 0,
      extraMax: row.extraMax ?? 0,
    }

    for (const col of target.columns) {
      const key = cellKey(row.id, col.id)
      const cell = target.cells[key] ?? (target.cells[key] = { ...defaultCell })

      cell.baseMax = cfg.baseMax
      cell.extraMax = cfg.extraMax

      if (cell.baseCurrent < 0) cell.baseCurrent = 0
      if (cell.extraCurrent < 0) cell.extraCurrent = 0
      if (cell.baseMax > 0 && cell.baseCurrent > cell.baseMax) cell.baseCurrent = cell.baseMax
      if (cell.extraMax > 0 && cell.extraCurrent > cell.extraMax) cell.extraCurrent = cell.extraMax
    }
  }
}

/** =========================
 *  Helpers
 *  ========================= */

function ensureColumnModes(columns: CharacterColumn[]) {
  for (const col of columns as any[]) {
    const base = createDefaultModes()
    if (!col.modes) col.modes = base

    col.modes = {
      conquest: { ...base.conquest, ...(col.modes.conquest ?? {}) },
      transcend: { ...base.transcend, ...(col.modes.transcend ?? {}) },
      sanctuary: { ...base.sanctuary, ...(col.modes.sanctuary ?? {}) },
    }

    for (const k of ['conquest', 'transcend', 'sanctuary'] as ColumnModeKey[]) {
      const a = col.modes[k].lastAction
      if (a && typeof a !== 'object') col.modes[k].lastAction = undefined
    }
  }
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
  // extraMax === 0 이면 "추가 자체 없음"
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
  if (cell.baseMax > 0) cell.baseCurrent = Math.min(cell.baseMax, cell.baseCurrent + d.base)
  else cell.baseCurrent += d.base

  if (hasExtraBucket(cell)) {
    if (isInfiniteExtra(cell)) cell.extraCurrent += d.extra
    else if (cell.extraMax > 0) cell.extraCurrent = Math.min(cell.extraMax, cell.extraCurrent + d.extra)
  }
}

/** =========================
 *  Load state (★ 여기서 applyMaxConfig 호출)
 *  ========================= */

function loadInitialState(): HomeworkState {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as HomeworkState
        if (parsed && parsed.columns && parsed.cells) {
          ensureColumnModes(parsed.columns)

          if (typeof (parsed as any).membership !== 'boolean') {
            ;(parsed as any).membership = false
          }

          // activeRowIds 보정
          if (!Array.isArray((parsed as any).activeRowIds)) {
            ;(parsed as any).activeRowIds = [...defaultActiveRowIds]
          } else {
            const allIds = rowDefs.filter(r => !r.isSection).map(r => r.id)
            const uniq = Array.from(new Set((parsed as any).activeRowIds))
            ;(parsed as any).activeRowIds = uniq.filter((id: string) => allIds.includes(id))
          }

          applyMaxConfig(parsed)
          return parsed
        }
      } catch {
        // ignore
      }
    }
  }

  const base: HomeworkState = {
    columns: defaultColumns,
    cells: {},
    lastAutoUpdate: new Date().toISOString(),
    membership: false,
    activeRowIds: [...defaultActiveRowIds],
  }

  // 기본 셀 생성(마스터 기준으로 모두 만들어두면 안전)
  for (const row of rowDefs.filter(r => !r.isSection)) {
    for (const col of base.columns) {
      base.cells[cellKey(row.id, col.id)] = { ...defaultCell }
    }
  }

  applyMaxConfig(base)
  return base
}

const state = ref<HomeworkState>(loadInitialState())
const columns = computed(() => state.value.columns)

/** =========================
 *  Cell getter
 *  ========================= */

function getCell(rowId: string, colId: string) {
  const key = cellKey(rowId, colId)
  let cell = state.value.cells[key]
  const def = getRowDefById(rowId)

  if (!cell) {
    const cfg = rowMaxConfig[rowId] ?? { baseMax: def?.baseMax ?? 0, extraMax: def?.extraMax ?? 0 }
    cell = {
      baseCurrent: 0,
      baseMax: cfg.baseMax,
      extraCurrent: 0,
      extraMax: cfg.extraMax,
    }
    state.value.cells[key] = cell
  }

  // max 동기화
  const cfg = rowMaxConfig[rowId] ?? { baseMax: def?.baseMax ?? 0, extraMax: def?.extraMax ?? 0 }
  cell.baseMax = cfg.baseMax
  cell.extraMax = cfg.extraMax

  if (cell.baseCurrent < 0) cell.baseCurrent = 0
  if (cell.extraCurrent < 0) cell.extraCurrent = 0
  if (cell.baseMax > 0 && cell.baseCurrent > cell.baseMax) cell.baseCurrent = cell.baseMax
  if (cell.extraMax > 0 && cell.extraCurrent > cell.extraMax) cell.extraCurrent = cell.extraMax

  return cell
}

/** =========================
 *  Mode actions (정복/초월/성역)
 *  ========================= */

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

  const odeCost = 40
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

  if (action.ticket) {
    const cell = getCell(action.ticket.rowId, colId)
    applyAdd(cell, { base: action.ticket.base, extra: action.ticket.extra })
  }

  if (action.ode) {
    const cell = getCell(action.ode.rowId, colId)
    applyAdd(cell, { base: action.ode.base, extra: action.ode.extra })
  }

  col.modes[mode].lastAction = undefined
}

/** =========================
 *  Column add/remove + drag
 *  ========================= */

const addColumnDialog = ref(false)
const newCharacterName = ref('')

function openAddColumn() {
  newCharacterName.value = ''
  addColumnDialog.value = true
}

function confirmAddColumn() {
  const name = newCharacterName.value.trim()
  if (!name) return

  const id = `char-${Date.now()}`
  state.value.columns.push({ id, name, modes: createDefaultModes() })

  // 마스터 기준으로 모든 컨텐츠에 셀 생성
  for (const row of rowDefs.filter(r => !r.isSection)) {
    getCell(row.id, id)
  }

  addColumnDialog.value = false
}

function removeColumn(colId: string) {
  if (state.value.columns.length <= 1) {
    window.alert('캐릭터는 최소 1개는 남아야 합니다.')
    return
  }

  const col = state.value.columns.find(c => c.id === colId)
  const name = col?.name?.trim() || '캐릭터'
  if (!window.confirm(`"${name}" 칸을 삭제할까요?`)) return

  const idx = state.value.columns.findIndex(c => c.id === colId)
  if (idx === -1) return

  state.value.columns.splice(idx, 1)

  // 모든 row에 대해 해당 colId 셀 삭제
  for (const row of rowDefs.filter(r => !r.isSection)) {
    delete state.value.cells[cellKey(row.id, colId)]
  }

  if (draggingColumnId.value === colId) draggingColumnId.value = null
  if (dropPreview.value?.targetId === colId) dropPreview.value = null
}

const draggingColumnId = ref<string | null>(null)
const dropPreview = ref<{ targetId: string; position: 'before' | 'after' } | null>(null)

function onColumnDragStart(colId: string, event: DragEvent) {
  draggingColumnId.value = colId
  dropPreview.value = null
  event.dataTransfer?.setData('text/plain', colId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
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
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onColumnDrop(colId: string, event: DragEvent) {
  event.preventDefault()

  const fromId = draggingColumnId.value
  const preview = dropPreview.value
  draggingColumnId.value = null
  dropPreview.value = null

  if (!fromId) return

  const cols = state.value.columns
  const fromIndex = cols.findIndex(c => c.id === fromId)
  let toIndex = cols.findIndex(c => c.id === colId)

  if (fromIndex === -1 || toIndex === -1) return
  if (fromIndex === toIndex && !preview) return

  if (preview?.targetId === colId && preview.position === 'after') toIndex += 1
  else toIndex += 1

  const [moved] = cols.splice(fromIndex, 1)
  if (fromIndex < toIndex) toIndex -= 1
  cols.splice(toIndex, 0, moved)
}

function onColumnDragEnd() {
  draggingColumnId.value = null
  dropPreview.value = null
}

/** =========================
 *  Content add/remove + drag
 *  ========================= */

const allContentDefs = computed(() => rowDefs.filter(r => !r.isSection))
const allContentIdSet = computed(() => new Set(allContentDefs.value.map(r => r.id)))

const inactiveContentDefs = computed(() => {
  const active = new Set(state.value.activeRowIds)
  return allContentDefs.value.filter(r => !active.has(r.id))
})

const displayRowDefs = computed<RowDef[]>(() => {
  const activeOrder = state.value.activeRowIds.filter(id => allContentIdSet.value.has(id))
  const out: RowDef[] = []
  const sections: SectionKey[] = ['ticket', 'daily', 'weekly']

  for (const sec of sections) {
    const secDef = rowDefs.find(r => r.isSection && r.sectionKey === sec)
    if (secDef) out.push(secDef)

    for (const id of activeOrder) {
      const def = getRowDefById(id)
      if (def && !def.isSection && def.sectionKey === sec) out.push(def)
    }
  }

  return out
})

// 컨텐츠 추가 다이얼로그
const addContentDialog = ref(false)
const selectedContentId = ref<string | null>(null)

function openAddContent() {
  selectedContentId.value = null
  addContentDialog.value = true
}

function ensureCellsForRow(rowId: string) {
  for (const col of state.value.columns) {
    getCell(rowId, col.id)
  }
}

function insertActiveRow(rowId: string) {
  const def = getRowDefById(rowId)
  if (!def || def.isSection || !def.sectionKey) return

  const ids = state.value.activeRowIds
  if (ids.includes(rowId)) return

  // 같은 섹션 마지막 뒤로 넣기
  let insertAt = -1
  for (let i = ids.length - 1; i >= 0; i--) {
    const d = getRowDefById(ids[i])
    if (d && d.sectionKey === def.sectionKey) {
      insertAt = i + 1
      break
    }
  }
  if (insertAt < 0) insertAt = ids.length

  ids.splice(insertAt, 0, rowId)
  ensureCellsForRow(rowId)
}

function confirmAddContent() {
  if (!selectedContentId.value) return
  insertActiveRow(selectedContentId.value)
  addContentDialog.value = false
}

function removeContentRow(rowId: string) {
  const def = getRowDefById(rowId)
  const name = def?.label ?? '컨텐츠'
  if (!window.confirm(`"${name}" 컨텐츠를 목록에서 제거할까요?`)) return

  // cells는 삭제하지 않음(값 유지)
  state.value.activeRowIds = state.value.activeRowIds.filter(id => id !== rowId)

  if (draggingRowId.value === rowId) draggingRowId.value = null
  if (dropPreviewRow.value?.targetId === rowId) dropPreviewRow.value = null
}

const draggingRowId = ref<string | null>(null)
const dropPreviewRow = ref<{ targetId: string; position: 'before' | 'after' } | null>(null)

function onRowDragStart(rowId: string, event: DragEvent) {
  draggingRowId.value = rowId
  dropPreviewRow.value = null
  event.dataTransfer?.setData('text/plain', rowId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onRowDragOver(rowId: string, event: DragEvent) {
  event.preventDefault()
  if (!draggingRowId.value || draggingRowId.value === rowId) {
    dropPreviewRow.value = null
    return
  }

  const target = event.currentTarget as HTMLElement | null
  let position: 'before' | 'after' = 'after'

  if (target) {
    const rect = target.getBoundingClientRect()
    const y = event.clientY - rect.top
    position = y < rect.height / 2 ? 'before' : 'after'
  }

  dropPreviewRow.value = { targetId: rowId, position }
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onRowDrop(rowId: string, event: DragEvent) {
  event.preventDefault()

  const fromId = draggingRowId.value
  const preview = dropPreviewRow.value
  draggingRowId.value = null
  dropPreviewRow.value = null

  if (!fromId) return

  const ids = state.value.activeRowIds
  const fromIndex = ids.findIndex(id => id === fromId)
  let toIndex = ids.findIndex(id => id === rowId)
  if (fromIndex === -1 || toIndex === -1) return
  if (fromIndex === toIndex) return

  if (preview?.targetId === rowId && preview.position === 'after') toIndex += 1

  const [moved] = ids.splice(fromIndex, 1)
  if (fromIndex < toIndex) toIndex -= 1
  ids.splice(toIndex, 0, moved)
}

function onRowDragEnd() {
  draggingRowId.value = null
  dropPreviewRow.value = null
}

/** =========================
 *  Auto increase
 *  ========================= */

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
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1)
  return d
})()

function countPeriodicEvents(last: Date, now: Date, anchor: Date, periodMs: number): number {
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
    if (max > 0) cell.baseCurrent = Math.min(max, cell.baseCurrent + amount)
    else cell.baseCurrent += amount
  }
}

function setBaseToMax(rowId: string) {
  for (const col of state.value.columns) {
    const cell = getCell(rowId, col.id)
    const max = cell.baseMax
    if (max > 0) cell.baseCurrent = max
  }
}

function handleAutoIncrease() {
  const now = new Date()

  let last = new Date(state.value.lastAutoUpdate || now.toISOString())
  if (isNaN(last.getTime())) last = now

  if (now.getTime() <= last.getTime()) {
    state.value.lastAutoUpdate = now.toISOString()
    return
  }

  const expeditionEvents = countPeriodicEvents(last, now, ANCHOR_5, 8 * HOUR_MS)
  if (expeditionEvents > 0) addBaseToRow('row-expedition', expeditionEvents * 1)

  const odeEvents = countPeriodicEvents(last, now, ANCHOR_5, 3 * HOUR_MS)
  if (odeEvents > 0) addBaseToRow('row-ode', odeEvents * 15)

  const chowolEvents = countPeriodicEvents(last, now, ANCHOR_5, 12 * HOUR_MS)
  if (chowolEvents > 0) addBaseToRow('row-chowol', chowolEvents * 1)

  const shugoEvents = countPeriodicEvents(last, now, ANCHOR_5, DAY_MS)
  if (shugoEvents > 0) {
    const perDay = state.value.membership ? 2 : 1
    addBaseToRow('row-shugo', shugoEvents * perDay)
  }

  const weeklyEvents = countPeriodicEvents(last, now, ANCHOR_WED_5, WEEK_MS)
  if (weeklyEvents > 0) {
    setBaseToMax('row-daily')
    setBaseToMax('row-awaken')
    setBaseToMax('row-boss')
  }

  const dimensionEvents = countPeriodicEvents(last, now, ANCHOR_5, DAY_MS)
  if (dimensionEvents > 0) addBaseToRow('row-dimension', dimensionEvents * 1)

  const missionEvents = countPeriodicEvents(last, now, ANCHOR_5, DAY_MS)
  if (missionEvents > 0) setBaseToMax('row-mission')

  state.value.lastAutoUpdate = now.toISOString()
}

/** =========================
 *  Save + Timer
 *  ========================= */

watch(
  state,
  (val) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    }
  },
  { deep: true }
)

let timerId: number | undefined

onMounted(() => {
  applyMaxConfig(state.value)
  handleAutoIncrease()
  timerId = window.setInterval(handleAutoIncrease, 60_000)
})

onBeforeUnmount(() => {
  if (timerId) window.clearInterval(timerId)
})
</script>

<template>
  <v-container class="py-8" fluid>
    <h1 class="text-h4 mb-2 font-weight-bold">숙제표 체크리스트</h1>
    <p class="text-body-1 mb-6 opacity-70">
      캐릭터별 숙제 현황을 기록하는 표입니다. 값은 브라우저에 저장되며 새로고침해도 유지됩니다.
    </p>

    <v-card class="hw-card" elevation="3">
      <v-card-title class="d-flex align-center justify-space-between">
        <div class="text-subtitle-1 font-weight-medium">
          일일 / 주간 숙제 관리
        </div>

        <div class="d-flex hw-actions">
          <v-btn size="small" variant="tonal" color="primary" @click="openAddColumn">
            + 캐릭터 추가
          </v-btn>

          <v-btn size="small" variant="tonal" color="secondary" @click="openAddContent">
            + 컨텐츠 추가
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
                      <div class="hw-name-row">
                        <v-text-field
                          v-model="col.name"
                          variant="underlined"
                          density="compact"
                          hide-details
                          class="hw-header-input"
                          placeholder="캐릭터명"
                        />

                        <v-btn
                          class="hw-col-remove-inline"
                          size="x-small"
                          variant="flat"
                          @click.stop="removeColumn(col.id)"
                          title="캐릭터 삭제"
                        >
                          -
                        </v-btn>
                      </div>

                      <div class="hw-mode-row">
                        <!-- 정복 -->
                        <div class="hw-mode-card" @click="doConquest(col.id)">
                          <div class="hw-mode-left">
                            <span class="hw-mode-label">정복</span>
                          </div>
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
                          <div class="hw-mode-left">
                            <span class="hw-mode-label">초월</span>
                          </div>
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
                          <div class="hw-mode-left">
                            <span class="hw-mode-label">성역</span>
                          </div>
                          <div class="hw-mode-right hw-sanctuary-check">
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
              <template v-for="row in displayRowDefs" :key="row.id">
                <tr v-if="row.isSection" class="hw-section-row">
                  <td class="hw-section-cell" :colspan="columns.length + 1">
                    {{ row.label }}
                  </td>
                </tr>

                <tr
                  v-else
                  class="hw-row"
                  @dragover="(e) => onRowDragOver(row.id, e)"
                  @drop="(e) => onRowDrop(row.id, e)"
                  @dragend="onRowDragEnd"
                  :class="{
                    'hw-row-drop-before':
                      dropPreviewRow && dropPreviewRow.targetId === row.id && dropPreviewRow.position === 'before',
                    'hw-row-drop-after':
                      dropPreviewRow && dropPreviewRow.targetId === row.id && dropPreviewRow.position === 'after',
                  }"
                >
                  <td class="hw-first-col">
                    <div class="hw-row-title">
                      <div class="hw-row-left">
                        <div
                          class="hw-row-handle"
                          draggable="true"
                          @dragstart="(e) => onRowDragStart(row.id, e)"
                          title="드래그로 순서 변경"
                        >
                          ⋯
                        </div>
                        <span>{{ row.label }}</span>
                      </div>

                      <div class="hw-row-right">
                        <label v-if="row.id === 'row-shugo'" class="hw-membership">
                          <input type="checkbox" v-model="state.membership" />
                          <span class="hw-membership-text">멤버십</span>
                        </label>

                        <v-btn
                          class="hw-row-remove"
                          size="x-small"
                          variant="flat"
                          @click.stop="removeContentRow(row.id)"
                          title="컨텐츠 제거"
                        >
                          -
                        </v-btn>
                      </div>
                    </div>
                  </td>

                  <td v-for="col in columns" :key="col.id">
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
          <v-text-field v-model="newCharacterName" label="캐릭터명" autofocus />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="addColumnDialog = false">취소</v-btn>
          <v-btn color="primary" @click="confirmAddColumn">확인</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 컨텐츠 추가 다이얼로그 -->
    <v-dialog v-model="addContentDialog" max-width="420">
      <v-card>
        <v-card-title>컨텐츠 추가</v-card-title>
        <v-card-text>
          <v-select
            v-model="selectedContentId"
            :items="inactiveContentDefs"
            item-title="label"
            item-value="id"
            label="추가할 컨텐츠 선택"
            placeholder="비활성 컨텐츠만 표시됩니다"
            :disabled="inactiveContentDefs.length === 0"
          />
          <div v-if="inactiveContentDefs.length === 0" class="text-caption opacity-70">
            현재 추가할 수 있는 컨텐츠가 없습니다.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="addContentDialog = false">취소</v-btn>
          <v-btn color="primary" :disabled="!selectedContentId" @click="confirmAddContent">
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

/* 드래그 핸들 바 (캐릭터) */
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

.opacity-70 {
  opacity: 0.7;
}

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

/* ✅ 드래그바 아래 내용만 좌우 여백 주기 */
.hw-col-header-content {
  padding: 0 10px 8px;
}

/* 캐릭터명 입력줄 + 삭제버튼 */
.hw-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.hw-name-row .hw-header-input {
  flex: 1;
  min-width: 0;
}
.hw-col-remove-inline {
  min-width: 26px !important;
  width: 26px !important;
  height: 26px !important;
  padding: 0 !important;
  border-radius: 8px !important;
  background: #e53935 !important;
  color: #fff !important;
  font-weight: 900;
  line-height: 1;
}
.hw-col-remove-inline:hover {
  filter: brightness(1.05);
}

/* 3개 카드 한 줄 */
.hw-mode-row {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.hw-mode-card {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr 64px;
  align-items: stretch;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.10);
  overflow: hidden;
}
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
.hw-mode-right {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 13px 13px;
}
.hw-x2 {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  margin-bottom: 10px;
}
.hw-x2 input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.hw-x2-box {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid rgba(255, 255, 255, 0.55);
  background: rgba(0, 0, 0, 0.15);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.35);
  display: inline-block;
}
.hw-x2 input:checked + .hw-x2-box {
  border-color: rgba(144, 202, 249, 0.95);
  background: rgba(144, 202, 249, 0.25);
  box-shadow: inset 0 0 0 2px rgba(144, 202, 249, 0.35);
}
.hw-x2-text {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: rgba(255, 255, 255, 0.88);
  text-transform: uppercase;
}
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
  margin: auto;
}

/* 행 타이틀 */
.hw-row-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.hw-row-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.hw-row-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* 행 드래그 핸들 */
.hw-row-handle {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.14);
  cursor: grab;
  user-select: none;
  font-weight: 900;
  line-height: 1;
  opacity: 0.9;
}
.hw-row-handle:active {
  cursor: grabbing;
}

/* 컨텐츠 제거 버튼 */
.hw-row-remove {
  min-width: 26px !important;
  width: 26px !important;
  height: 26px !important;
  padding: 0 !important;
  border-radius: 8px !important;
  background: rgba(229, 57, 53, 0.95) !important;
  color: #fff !important;
  font-weight: 900;
  line-height: 1;
}

/* 드롭 프리뷰(위/아래 라인) */
.hw-row.hw-row-drop-before td {
  box-shadow: inset 0 3px 0 0 rgb(144, 202, 249);
}
.hw-row.hw-row-drop-after td {
  box-shadow: inset 0 -3px 0 0 rgb(144, 202, 249);
}

/* 슈고 멤버십 */
.hw-membership {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  opacity: 0.9;
}
.hw-membership input[type="checkbox"] {
  width: 14px;
  height: 14px;
}
.hw-membership-text {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}
</style>