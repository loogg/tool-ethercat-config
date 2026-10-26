import { useEffect } from 'react'
import { BaseEdge, Controls, ControlButton, Handle, Position, getViewportForBounds, useNodeId, useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import { Maximize } from 'lucide-react'
import './routed-diagram.css'

export function RoutedHandles({ ports = [] }) {
  const id = useNodeId(), update = useUpdateNodeInternals()
  const { viewportInitialized } = useReactFlow()
  const key = JSON.stringify(ports)
  useEffect(() => { if (id && viewportInitialized) update(id) }, [id, key, update, viewportInitialized])
  return ports.map(port => <Handle key={port.id} id={port.id} type={port.type} position={Position[port.side[0].toUpperCase() + port.side.slice(1)]} style={{ [port.side === 'left' || port.side === 'right' ? 'top' : 'left']: `${port.offset * 100}%` }} className="diagram-route-handle" isConnectable={false} />)
}

export function RoutedEdge(props) {
  const route = props.data?.route
  if (!route) return null
  return <BaseEdge id={props.id} path={route.path} markerStart={props.markerStart} markerEnd={props.markerEnd} style={{ ...props.style, strokeLinejoin: 'round', strokeLinecap: 'round' }} interactionWidth={props.interactionWidth || 24} label={props.label} labelX={route.label?.centerX} labelY={route.label?.centerY} labelStyle={props.labelStyle} labelShowBg labelBgStyle={props.labelBgStyle || { fill: '#fff' }} labelBgPadding={props.labelBgPadding || [6, 4]} labelBgBorderRadius={3} />
}

export function ResponsiveViewport({ diagram }) {
  const { setViewport, viewportInitialized } = useReactFlow()
  const { auto, pending, fitKey, layout, bounds } = diagram
  useEffect(() => {
    if (!viewportInitialized || !auto || pending || !layout || !bounds) return
    // Include routed edges and their labels; do not race React Flow's node measurement.
    const frame = requestAnimationFrame(() => {
      // Reserve space for the follow toggle, zoom controls and expand button.
      const viewport = getViewportForBounds({ x: 0, y: 0, width: layout.width, height: layout.height }, Math.max(1, bounds.width - 24), Math.max(1, bounds.height - 84), .1, 1, 0)
      setViewport({ ...viewport, x: viewport.x + 12, y: viewport.y + 28 }, { duration: 0 })
    })
    return () => cancelAnimationFrame(frame)
  }, [viewportInitialized, auto, pending, fitKey, layout, bounds, setViewport])
  return null
}

export function DiagramStatus({ diagram }) {
  return <div className="diagram-status"><button type="button" aria-label={diagram.auto ? '暂停跟随窗口' : '恢复自动适配'} aria-pressed={diagram.auto} onClick={diagram.auto ? diagram.pauseAuto : diagram.resumeAuto} title="窗口变化时自动排版并适配；手动缩放或平移后暂停。">{diagram.auto ? '跟随窗口' : '恢复自动适配'}</button>{diagram.pending && <span role="status">正在排版…</span>}{diagram.error && <span role="alert">排版失败，可重试或切换列表。<button type="button" onClick={diagram.retry}>重试</button></span>}</div>
}

export function DiagramControls({ diagram, fitLabel = '适应视图', children }) {
  return <Controls showInteractive={false} showFitView={false} onZoomIn={diagram.pauseAuto} onZoomOut={diagram.pauseAuto}><ControlButton onClick={diagram.resumeAuto} aria-label={fitLabel} title={fitLabel}><Maximize size={16}/></ControlButton>{children}</Controls>
}
