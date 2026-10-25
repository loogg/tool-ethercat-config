import { calculateWatchdogs } from './calculations.js'

export const watchdogScenarios = [
  { id: 'continuous', label: '两侧持续触发', stopPdi: false, stopSm: false },
  { id: 'pdi-stop', label: 'PDI侧停止访问', stopPdi: true, stopSm: false },
  { id: 'sm-stop', label: '主站过程数据中断', stopPdi: false, stopSm: true },
  { id: 'both-stop', label: '两侧都停止', stopPdi: true, stopSm: true },
]

/** Nominal teaching traces, not sampled waveforms or an ESC firmware emulator. */
export function watchdogTiming({ scenario = 'continuous', time = 180, pdiDisabled = false, smDisabled = false, divider = 2498, pdiCount = 1000, smCount = 1000, triggerInterval = 20, stopTime = 60, end = 220 } = {}) {
  const choice = watchdogScenarios.find(item => item.id === scenario) || watchdogScenarios[0]
  for (const [name, value, min, max] of [['触发间隔', triggerInterval, .001, 100000], ['停止时间', stopTime, 0, 100000], ['观察窗口', end, .001, 100000]]) {
    if (String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(`${name}须在 ${min}–${max} ms 之间。`)
  }
  triggerInterval = Number(triggerInterval); stopTime = Number(stopTime); end = Number(end)
  if (end / triggerInterval > 2000) throw new Error('观察窗口内最多绘制 2000 次触发；请增大间隔或缩短窗口。')
  const now = Math.max(0, Math.min(end, Number.isFinite(Number(time)) ? Number(time) : 0))
  const parameters = calculateWatchdogs({ divider, pdiCount: pdiDisabled ? 0 : pdiCount, smCount: smDisabled ? 0 : smCount })
  function lane(id, stopped, counter) {
    const scheduled = Array.from({ length: Math.floor(end / triggerInterval) + 1 }, (_,i) => Number((i * triggerInterval).toFixed(6))).filter(t => !stopped || t <= stopTime)
    const events = scheduled.filter(t => t <= now)
    const lastTrigger = events.at(-1) ?? null
    const deadline = counter.enabled && lastTrigger !== null ? lastTrigger + counter.value : null
    const expired = counter.enabled && deadline !== null && now >= deadline
    const expiries = counter.enabled ? scheduled.flatMap((at, i) => at + counter.value < (scheduled[i + 1] ?? Infinity) && at + counter.value <= end ? [at + counter.value] : []) : []
    return { id, stopped, count: counter.count, enabled: counter.enabled, events, scheduled, expiries, lastTrigger, deadline, timeout: counter.value, state: !counter.enabled ? 'disabled' : expired ? 'expired' : 'waiting', interrupted: stopped && now > stopTime }
  }
  return { time: now, end, stopTime, triggerInterval, parameters, scenario: choice, lanes: [lane('pdi', choice.stopPdi, parameters.pdi), lane('sm', choice.stopSm, parameters.sm)] }
}
