// Static source values only. No C expressions, callbacks or runtime reads are evaluated.
export function sourceType(raw, declaredBits = null, typeMap = null, seen = new Set()) {
  const name = String(raw ?? '').trim(), key = name.toUpperCase().replace(/\s+/g, '')
  let kind = null, bits = null
  if (['BOOL', 'BOOLEAN', 'BIT'].includes(key)) { kind = 'uint'; bits = 1 }
  const bit = key.match(/^BIT([1-8])$/)
  if (bit) { kind = 'uint'; bits = Number(bit[1]) }
  const pad = key.match(/^PAD_(\d+)$/)
  if (pad) { kind = 'padding'; bits = Number(pad[1]) }
  const aliases = { BYTE: ['uint',8], USINT: ['uint',8], SINT: ['int',8], UINT: ['uint',16], WORD: ['uint',16], INT: ['int',16], UDINT: ['uint',32], DWORD: ['uint',32], DINT: ['int',32], ULINT: ['uint',64], LWORD: ['uint',64], LINT: ['int',64], REAL: ['float',32], FLOAT: ['float',32], LREAL: ['float',64], DOUBLE: ['float',64] }
  if (aliases[key]) [kind,bits] = aliases[key]
  const scalar = key.match(/^(UNSIGNED|UINT|INTEGER|INT)(8|16|24|32|40|48|56|64)$/)
  if (scalar) { kind = ['UNSIGNED','UINT'].includes(scalar[1]) ? 'uint' : 'int'; bits = Number(scalar[2]) }
  const string = key.match(/^(STRING|VISIBLE_STRING|OCTET_STRING|OCTETSTRING)\((\d+)\)$/)
  if (string) { kind = string[1].includes('OCTET') ? 'bytes' : 'string'; bits = Number(string[2]) * 8 }
  if (!kind && typeMap?.has(name) && !seen.has(name)) {
    const node = typeMap.get(name), next = new Set(seen); next.add(name)
    const field = n => node.children?.find(c=>c.name===n)?.value
    const base = field('BaseType')
    if (base) return sourceType(base, declaredBits ?? numeric(field('BitSize')), typeMap, next)
    if (node.children?.some(c=>['SubItem','ArrayInfo'].includes(c.name))) return { raw:name,kind:'structured',bits:null,declaredBits,issue:'复合/数组条目未展开，不把整体BitSize当作单个SI位长。' }
  }
  if (!kind && ['VISIBLE_STRING','OCTET_STRING','STRING'].includes(key) && declaredBits !== null) { kind = key==='OCTET_STRING'?'bytes':'string'; bits=declaredBits }
  if (bits!==null&&(!Number.isInteger(bits)||bits<1||bits>65535))return {raw:name,kind:kind||'unknown',bits:null,declaredBits,issue:'类型位长超出当前预览范围，保留原文。'}
  if (kind && declaredBits !== null && bits !== declaredBits) return { raw:name,kind,bits:null,declaredBits,issue:`类型位长${bits}与源BitSize ${declaredBits}不同，保留原文待核对。` }
  return { raw:name,kind:kind||'unknown',bits,declaredBits,issue:bits===null?'类型位长未解析。':null }
}

export function numeric(raw) {
  if (raw === null || raw === undefined || String(raw).trim()==='') return null
  const s = String(raw).trim().replace(/^#x/i,'0x')
  return /^(?:0x[\da-f]+|\d+)$/i.test(s) && Number.isSafeInteger(Number(s)) ? Number(s) : null
}
const unknown = (raw, reason='未提供默认值') => ({known:false,raw,state:raw===null||raw===undefined||raw===''?'unknown':'unparsed',reason,bitsValue:null})
export function sourceDefault(raw, type, { hexData=false, basis='default' }={}) {
  if (raw === null || raw === undefined || String(raw).trim()==='') return unknown(raw)
  if (!Number.isInteger(type.bits) || type.bits<1 || type.bits>65535) return unknown(raw,'未确定有效位长')
  const s = String(raw).trim()
  try {
    let value
    if (hexData) {
      if (!/^(?:[\da-f]{2})+$/i.test(s) || s.length/2!==Math.ceil(type.bits/8)) return unknown(raw,'DefaultData长度或十六进制格式与条目位长不符')
      value = s.match(/../g).reduce((v,b,i)=>v+(BigInt(parseInt(b,16))<<BigInt(i*8)),0n)
      if (value >= (1n<<BigInt(type.bits))) return unknown(raw,'DefaultData包含超出有效位长的位')
    } else if (type.kind==='float') {
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s) || !Number.isFinite(Number(s))) return unknown(raw,'浮点默认值不是有限常数')
      const buffer = new ArrayBuffer(type.bits/8), view = new DataView(buffer)
      if(type.bits===32)view.setFloat32(0,Number(s),true);else if(type.bits===64)view.setFloat64(0,Number(s),true);else return unknown(raw,'浮点位长未覆盖')
      if (!Number.isFinite(type.bits===32?view.getFloat32(0,true):view.getFloat64(0,true))) return unknown(raw,'浮点默认值溢出')
      value = [...new Uint8Array(buffer)].reduce((v,b,i)=>v+(BigInt(b)<<BigInt(i*8)),0n)
    } else if (type.kind==='string') {
      if (!/^"[\x20-\x7e]*"$/.test(s)) return unknown(raw,'文本编码或字符串写法未确认；保留原文')
      const bytes=[...s.slice(1,-1)].map(c=>c.charCodeAt(0));if(bytes.length>type.bits/8)return unknown(raw,'字符串超出声明长度')
      value=bytes.reduce((v,b,i)=>v+(BigInt(b)<<BigInt(i*8)),0n)
    } else {
      let n
      if (/^(true|false)$/i.test(s) && type.bits===1) n = /^true$/i.test(s)?1n:0n
      else {
        const normalized=s.replace(/^#x/i,'0x')
        if (!/^(?:-?\d+|0x[\da-f]+)$/i.test(normalized)) return unknown(raw,'默认值不是已覆盖的字面常数；不执行表达式')
        n=BigInt(normalized)
      }
      const signed=type.kind==='int', min=signed?-(1n<<BigInt(type.bits-1)):0n, max=signed?(1n<<BigInt(type.bits-1))-1n:(1n<<BigInt(type.bits))-1n
      if(n<min||n>max)return unknown(raw,'默认值超出类型范围')
      value=n<0?n+(1n<<BigInt(type.bits)):n
    }
    return {known:true,raw,state:basis,bitsValue:value,reason:basis==='generated'?'按当前定义生成的预览值':'源文件默认值，非设备运行值'}
  } catch { return unknown(raw,'默认值解析失败，未补零') }
}

export function sourcePermission(raw, operation, state) {
  if (raw===null||raw===undefined||String(raw).trim()==='') return {allowed:null,reason:'访问权限未声明'}
  const read=new Set(),write=new Set(),all=['PREOP','SAFEOP','OP']
  for (const token of String(raw).toLowerCase().split(',').map(s=>s.trim()).filter(Boolean)) {
    if(['ro','rw'].includes(token))all.forEach(s=>read.add(s))
    if(['wo','rw'].includes(token))all.forEach(s=>write.add(s))
    if(['ro','rw','wo'].includes(token))continue
    const m=token.match(/^(rd|wr)_((?:preop|safeop|op)(?:_(?:preop|safeop|op))*)$/)
    if(!m)return {allowed:null,reason:`权限写法${token}未解析`}
    m[2].split('_').map(s=>s.toUpperCase()).forEach(s=>(m[1]==='rd'?read:write).add(s))
  }
  const set=operation==='read'?read:write
  return {allowed:set.has(state),reason:set.has(state)?'文件权限允许该假设状态':set.size?'声明权限不允许该状态':'声明中没有该方向权限',abortCode:set.size?'0x08000022':operation==='read'?'0x06010001':'0x06010002'}
}
