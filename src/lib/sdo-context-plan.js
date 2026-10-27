import { analyzeSscObjectLayout } from './ssc-object-layout.js'
import { sourcePermission } from './sdo-source-types.js'

export function contextStorage(object) {
  const ordered=[...object.entries].sort((a,b)=>(a.si??256)-(b.si??256))
  let offset=0,previous=-1
  const rows=ordered.map(entry=>{
    if(entry.si===null||entry.si!==previous+1||entry.logicalBits===null)offset=null
    const bits=entry.role==='header'&&object.compound?16:entry.logicalBits
    const kind=entry.type.kind
    const cType=entry.role==='header'?'UINT16':[8,16,32,64].includes(entry.logicalBits)&&['int','uint'].includes(kind)?`${kind==='int'?'INT':'UINT'}${entry.logicalBits}`:kind==='float'?`浮点${entry.logicalBits}`:kind==='padding'?'显式填充':entry.logicalBits!==null&&entry.logicalBits<8?'位字段（容器待核对）':'类型/容器待核对'
    const row={entry,id:entry.id,si:entry.si,bits,bitOffset:offset,cType}
    offset=offset!==null&&bits!==null?offset+bits:null;previous=entry.si??256
    return row
  })
  let issues=[]
  if(rows.every(r=>r.bits!==null&&r.bits>0)&&object.compound) {
    const analysis=analyzeSscObjectLayout(rows.map(r=>({name:r.entry.name,bits:String(r.bits),padding:r.entry.type.kind==='padding'})))
    issues=analysis.issues.map(i=>i.message)
  }
  if(!object.entries.length||rows.some(r=>r.bitOffset===null))issues.push('子项、位长或连续索引未完整确定，后续本地偏移保持未知。')
  return {rows,totalBits:offset,status:issues.length?'needs-review':'rule-preview',issues,basis:'SSC默认访问层预期 · 非生成C代码验证',assumptions:'偏移按8bit Byte表示；实际寻址单位、编译器填充和自定义访问层另核对。'}
}

const parseStart = raw => {const s=String(raw??'').trim();return /^(?:0x[\da-f]+|\d+)$/i.test(s)&&Number(s)>=0&&Number(s)<=255?Number(s):null}
const bounds = range => range.start+range.bits
export function deriveContextAccess(object, request) {
  const storage=contextStorage(object),plan={object,storage,start:parseStart(request.start),checks:[],pending:[],segments:[],cells:[],byteLength:null,kind:'unresolved',message:'',abortCode:null}
  const stop=(kind,message,abortCode=null)=>({...plan,kind,message,abortCode})
  const check=(id,label,status,detail)=>plan.checks.push({id,label,status,detail})
  if(plan.start===null||!['single','complete'].includes(request.mode)||!['read','write'].includes(request.operation)||!['PREOP','SAFEOP','OP'].includes(request.state))return stop('input','起始SI须为0…255整数，并选择有效的请求参数。')
  check('input','请求参数','pass','有效的格式预览参数；不是设备请求。')
  const ca=request.mode==='complete',header=object.entries.find(e=>e.si===0&&e.role==='header')
  if(ca&&object.code==='VARIABLE')return stop('invalid','当前文件解析为标量对象，SSC默认不接受该复合CA路径。','0x06010000')
  if(ca&&plan.start>1)return stop('invalid','CA只能从SI0或SI1开始；点选成员不改变此约束。','0x06010000')
  check('start','访问起点','pass',ca?'CA起点为0或1。':'单项访问按当前条目解释。')
  if(ca&&(object.capability.device===false||object.capability.object===false)) {
    check('capability','文件CA声明','fail',object.capability.source)
    return stop('blocked',object.capability.device===false&&object.capability.object===true?'设备与对象的CA声明冲突，当前不生成可访问载荷。':'当前XML的设备/对象声明不提供CA；只显示定义，单项访问另行判断。')
  }
  if(ca) {
    check('capability','CA实际支持','unknown','静态声明不能证明固件实际实现。')
    plan.pending.push('CA实际实现/工程配置未验证')
  }
  const selected=ca?object.entries:object.entries.filter(e=>e.si===plan.start)
  if(!selected.length)return stop(object.complete?'invalid':'unresolved',object.complete?'当前文件未定义这个SI。':'当前来源没有展开这个SI，不能据此断言设备不存在该子项。',object.complete?'0x06090011':null)
  if(!ca&&selected.length!==1)return stop('unresolved','来源中这个SI有多条定义，未任意选择一个。')
  let segments=[]
  if(!ca) {
    const entry=selected[0]
    if(entry.logicalBits===null)return stop('unresolved','当前条目位长未解析；保留源类型/BitSize，不猜测载荷长度。')
    segments=[{id:entry.id,entry,si:entry.si,start:0,bits:entry.logicalBits,role:'entry'}]
    plan.byteLength=Math.ceil(entry.logicalBits/8)
  } else {
    if(!object.compound||!header||header.logicalBits!==8)return stop('unresolved','复合组织、SI0或其8bit定义未完整确认，无法建立默认CA布局。')
    const origin=plan.start===1?16:0
    if(object.layoutOrigin==='ssc-sequence') {
      if(!object.complete||storage.status!=='rule-preview'||storage.totalBits===null)return stop('unresolved','当前工作表不满足默认SSC排列前提，不能用隐式填充修补CA布局；请查看本地规则提示。')
      segments=storage.rows.filter(r=>r.si>=plan.start).map(r=>({id:r.id,entry:r.entry,si:r.si,start:r.bitOffset-origin,bits:r.entry.logicalBits,role:r.entry.type.kind==='padding'?'explicit-padding':'entry'}))
      plan.byteLength=Math.ceil((storage.totalBits-origin)/8)
      plan.pending.push('按定义上界预览，运行时SI0/实际访问范围未知')
    } else {
      if(object.totalBits===null||object.totalBits<origin||object.totalBits>65535)return stop('unresolved','源对象/类型总BitSize未确定或超出当前预览范围，未猜测总长度。')
      for(const entry of object.entries) {
        if(entry.si===0&&plan.start===1)continue
        if(entry.declaredOffset===null||entry.logicalBits===null) {plan.pending.push(`${entry.name}的位长/BitOffs未确定`);continue}
        if(entry.si!==0&&entry.declaredOffset<16)return stop('unresolved','源业务成员位于SI0的16bit CA前缀内，保留原始偏移并提示核对。')
        segments.push({id:entry.id,entry,si:entry.si,start:entry.declaredOffset-origin,bits:entry.logicalBits,role:'entry'})
      }
      if(header.declaredOffset!==0)return stop('unresolved','当前XML没有明确将SI0置于bit0，未重写源偏移。')
      plan.byteLength=Math.ceil((object.totalBits-origin)/8)
      plan.pending.push('按XML字典类型布局预览，运行范围未验证')
    }
    if(plan.start===0)segments.push({id:'ca-padding',entry:null,si:null,start:8,bits:8,role:'ca-padding'})
  }
  if(plan.byteLength>8192)return stop('unresolved','对象数据超出当前8192Byte展示上限；来源定义仍保留。')
  const ranges=[...segments].sort((a,b)=>a.start-b.start)
  for(let i=0;i<ranges.length;i++) {
    if(ranges[i].start<0||bounds(ranges[i])>plan.byteLength*8)return stop('unresolved','源位段超出声明范围，未截断或移动数据。')
    if(i&&ranges[i].start<bounds(ranges[i-1]))return stop('unresolved','源位段重叠，未生成猜测的CA载荷。')
  }
  const access=segments.filter(s=>s.entry).map(s=>({segment:s,...sourcePermission(s.entry.access,request.operation,request.state)}))
  const allowed=access.filter(a=>a.allowed===true),unknown=access.filter(a=>a.allowed===null)
  if(!ca&&access[0]?.allowed===false)return stop('invalid',access[0].reason,access[0].abortCode)
  if(ca&&!allowed.length&&!unknown.length&&access.length)return stop('blocked','当前文件没有允许该假设状态/方向的CA成员；实际Abort还取决于所用SSC版本、检查顺序与回调。')
  if(unknown.length)plan.pending.push('部分条目权限未声明/未解析')
  if(access.some(a=>a.allowed===false))plan.pending.push(request.operation==='write'?'CA中只读/状态受限段按默认SSC路径跳过，不能当作已写入':'CA不可读段按默认SSC路径保留零占位，具体回调另核对')
  check('permission','文件权限',unknown.length?'unknown':'pass','按每个子项独立判断，未把对象头权限复制到成员。')
  const cells=Array.from({length:plan.byteLength},(_,i)=>({offset:i,value:0,mask:0,parts:[]}))
  for(const segment of segments) {
    const permission=access.find(a=>a.segment===segment)
    let known=segment.role==='ca-padding'||segment.role==='explicit-padding'||!!segment.entry?.value.known
    let value=segment.entry?.value.bitsValue??0n
    segment.disposition=permission?.allowed===false?(request.operation==='write'?'ignored':'masked'):permission?.allowed===null?'permission-unknown':'included'
    if(permission?.allowed===false&&request.operation==='read') {known=true;value=0n}
    if(permission?.allowed===null&&ca&&request.operation==='read')known=false
    if(segment.entry?.callback?.[request.operation])plan.pending.push('当前条目有自定义访问回调，默认排列/处理须源码核对')
    if(!known&&segment.entry)plan.pending.push('存在未知/未解析默认值，相关字节显示??')
    for(let bit=0;bit<segment.bits;bit++) {
      const pos=segment.start+bit,cell=cells[Math.floor(pos/8)],mask=1<<(pos%8)
      if(known) {cell.mask|=mask;if((value>>BigInt(bit))&1n)cell.value|=mask}
      if(!cell.parts.includes(segment.id))cell.parts.push(segment.id)
    }
  }
  // Canonical single-entry representation: high unused bits of its final data byte are zero.
  if(!ca&&segments[0].bits%8)cells.at(-1).mask|=(255<<segments[0].bits%8)&255
  if(ca&&cells.some(c=>c.mask!==255&&c.parts.length===0))plan.pending.push('源字典间隙/尾部未说明，不自动补零')
  plan.segments=segments;plan.cells=cells;plan.pending=[...new Set(plan.pending)]
  return {...plan,kind:'preview',message:'按当前来源定义和默认值作结构预览，实际固件支持、运行值与C布局未验证。'}
}
