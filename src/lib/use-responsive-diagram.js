import { useEffect, useMemo, useState } from 'react'
import { diagramKey, layoutDiagram } from './graph-layout.js'

export function useResponsiveDiagram(model, { preference = 'auto', enabled = true } = {}) {
  const [canvasElement, attachCanvas] = useState(null)
  const modelKey = diagramKey(model)
  const geometry = useMemo(() => JSON.parse(modelKey), [modelKey])
  const viewKey = `${preference}:${modelKey}`
  const [measurement, setMeasurement] = useState(null)
  const bounds = canvasElement && measurement?.element === canvasElement ? measurement : null
  const [mode, setMode] = useState({ key: viewKey, auto: true, frozen: null })
  if (mode.key !== viewKey) setMode({ key: viewKey, auto: true, frozen: null })
  const auto = mode.key === viewKey ? mode.auto : true
  const size = auto ? bounds : mode.frozen || bounds
  const [retry, setRetry] = useState(0), [fitEpoch, setFitEpoch] = useState(0)
  const requestKey = `${viewKey}:${size?.width || 0}x${size?.height || 0}:${retry}`
  const [result, setResult] = useState({ requestKey: '', viewKey: '', layout: null, error: null })

  useEffect(() => {
    if (!enabled || !canvasElement) return
    let timer, first = true
    const observer = new ResizeObserver(([record]) => {
      const width = Math.round(record.contentRect.width / 4) * 4, height = Math.round(record.contentRect.height / 4) * 4
      if (width < 1 || height < 1) return
      clearTimeout(timer)
      const apply = () => setMeasurement(previous => previous?.element === canvasElement && previous.width === width && previous.height === height ? previous : { element: canvasElement, width, height })
      if (first) { first = false; apply() }
      else timer = setTimeout(apply, 140)
    })
    observer.observe(canvasElement)
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [enabled, canvasElement])

  useEffect(() => {
    if (!enabled || !canvasElement || !size) return
    let stale = false
    layoutDiagram(geometry, { preference, width: Math.max(1, size.width - 40), height: Math.max(1, size.height - 40) }).then(layout => {
      if (!stale) setResult({ requestKey, viewKey, layout, error: null })
    }).catch(error => {
      if (!stale) setResult({ requestKey, viewKey, layout: null, error: error.message })
    })
    return () => { stale = true }
  }, [enabled, canvasElement, geometry, preference, size, requestKey, viewKey])

  const layout = size && result.viewKey === viewKey ? result.layout : null
  const pending = enabled && result.requestKey !== requestKey
  const error = result.requestKey === requestKey ? result.error : null
  function pauseAuto() { setMode(previous => previous.key === viewKey && !previous.auto ? previous : { key: viewKey, auto: false, frozen: bounds }) }
  function resumeAuto() { setMode({ key: viewKey, auto: true, frozen: null }); setFitEpoch(previous => previous + 1) }
  return { attachCanvas, layout, pending, error, auto, bounds, direction: layout?.direction || (preference === 'vertical' ? 'TB' : 'LR'), fitKey: `${requestKey}:${fitEpoch}`, pauseAuto, resumeAuto, retry: () => setRetry(previous => previous + 1), onMove: event => { if (event) pauseAuto() } }
}
