import { RoutedEdge } from './RoutedDiagram.jsx'
export const routedEdgeTypes = { routed: RoutedEdge }

export function nodeHandles({ ports, width, height }) {
  return ports.map(port => ({ id: port.id, type: port.type, position: port.side, width: 0, height: 0, x: port.side === 'left' ? 0 : port.side === 'right' ? width : port.offset * width, y: port.side === 'top' ? 0 : port.side === 'bottom' ? height : port.offset * height }))
}

export function diagramNodes(nodes, layout) {
  if (!layout) return []
  const byId = new Map(nodes.map(node => [node.id, node]))
  return layout.nodes.map(geometry => {
    const node = byId.get(geometry.id)
    return { ...node, parentId: geometry.parentId, position: { x: geometry.x, y: geometry.y }, initialWidth: geometry.width, initialHeight: geometry.height, handles: nodeHandles(geometry), style: { ...node.style, width: geometry.width, height: geometry.height }, data: { ...node.data, ports: geometry.ports } }
  })
}
export function diagramEdges(edges, layout) {
  if (!layout) return []
  const byId = new Map(edges.map(edge => [edge.id, edge]))
  return layout.edges.map(route => ({ ...byId.get(route.id), type: 'routed', sourceHandle: route.sourceHandle, targetHandle: route.targetHandle, data: { ...byId.get(route.id)?.data, route } }))
}
