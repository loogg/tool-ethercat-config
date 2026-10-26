import { layoutDiagram } from './graph-layout.js'

export function buildEsiFieldGraph(row,context){
  const nodes=[{id:'current',focal:true,surface:'ESI',role:'当前文件',title:row.label,path:row.key,value:row.value}],edges=[]
  const name=row.attribute||row.node.name
  row.associations.forEach((t,i)=>{
    const id=`target-${i}`
    nodes.push({id,surface:t.surface==='APP'?'应用对象字典定义':t.surface==='SSC'?'SSC Tool':t.surface,role:'字段规则',title:t.title,path:t.path,targetRef:t})
    if(name==='BitLen'&&t.surface==='SSC'){
      const rule=`calc-${i}`
      nodes.push({id:rule,surface:'计算',role:'成立条件',title:'活动 PDO → Byte',path:'先确认 Mapping / Assignment',value:'L = ceil(Σbit / 8)'})
      edges.push({id:`edge-current-${i}`,source:'current',target:rule,kind:'derive',label:'参与位宽求和',condition:'仅被选入活动映射的 Entry 参与；不能把所有候选 PDO 相加。'})
      edges.push({id:`edge-rule-${i}`,source:rule,target:id,kind:'constrain',label:'L ≤ 容量',condition:t.condition,targetRef:t})
    }else{
      const constrained=t.relationKind==='constrain',kind=name==='BitLen'?'derive':t.relationKind
      edges.push({id:`edge-${i}`,source:constrained?'current':id,target:constrained?id:'current',kind,label:name==='BitLen'?'协议位宽':name==='Default'?'默认选择':kind==='generate'?'生成对应':kind==='derive'?'参与计算':kind==='constrain'?'约束条件':'概念对应',condition:name==='BitLen'&&t.surface==='APP'?'应用 DataType 决定被映射成员的协议位宽；显式填充和实际映射选择须另外核对。':t.condition,targetRef:t})
    }
  })
  if(['SlotIndexIncrement','SlotPdoIncrement'].includes(name)){
    const pdo=name==='SlotPdoIncrement'
    nodes.push({id:'instance',surface:'计算',role:'规则预览',title:pdo?'实例 PDO 索引':'实例对象 / Entry 索引',path:'模板索引 + 实例号 × 基础步长',value:pdo?'P = P₀ + k × S':'I = I₀ + k × S'})
    edges.push({id:'edge-instance',source:'current',target:'instance',kind:'derive',label:'按依赖标记展开',condition:'仅对相应 Index 声明 DependOnSlot 的项目生效。Slot 可覆盖 Slots 步长；SlotGroup、重复实例与溢出另核对。'})
  }
  return {nodes,edges,scope:context.ownerScope?.owner.id||context.scope?.device.id}
}

export function esiFieldDiagram(model) {
  return { nodes: model.nodes.map(node => ({ id: node.id, width: 236, height: 132 })), edges: model.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label, labelFontSize: 11 })) }
}
export async function layoutEsiFieldGraph(model, width = 600, height = 500) {
  const layout = await layoutDiagram(esiFieldDiagram(model), { width, height })
  const byId = new Map(layout.nodes.map(node => [node.id, node]))
  const routes = new Map(layout.edges.map(edge => [edge.id, edge]))
  return { ...layout, nodes: model.nodes.map(node => ({ ...node, ...byId.get(node.id), position: { x: byId.get(node.id).x, y: byId.get(node.id).y } })), edges: model.edges.map(edge => ({ ...edge, ...routes.get(edge.id) })) }
}
