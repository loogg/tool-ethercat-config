export const si0Protocol = Object.freeze({ type: 'UNSIGNED8', typeId: 0x0005, logicalBits: 8 })

export const sdoAccessEvidence = [
  { title: 'Beckhoff ET9300 V1.10 §7.2 / §7.3', url: 'https://download.beckhoff.com/download/Document/io/ethercat-development-products/an_et9300_v1i10.pdf#page=62', scope: 'ARRAY/RECORD 的 SI0 条目描述为8 bit，SSC默认本地分配为16 bit；本地布局属于栈实现约束。' },
  { title: 'Helmholz TB20 V02 §9.5.1 · 正文87页', url: 'https://www.helmholz.de/media/pdf/83/1f/dd/Handbuch_TB20_EtherCAT_Koppler_V2_EN.pdf#page=87', scope: '厂商官方CA说明：起点0/1，其他起点以0x06010000中止；包含SI0时其后有1Byte填充。' },
  { title: 'MathWorks · CoE对象数据布局', url: 'https://www.mathworks.com/help/slrealtime/io_ref/configuring-the-ethercat-library-blocks.html', scope: 'SI0单项有效数据1Byte，CA包含SI0时其后是零填充Byte。' },
]

const uint = (subIndex, name, logicalBits, value) => ({ subIndex, name, type: `UNSIGNED${logicalBits}`, typeId: { 8: 0x0005, 16: 0x0006, 32: 0x0007 }[logicalBits], logicalBits, value, role: 'value' })

// These are explicitly independent teaching values, never an inferred source file instance.
export function sdoTeachingObject(code = 'RECORD') {
  if (!['ARRAY', 'RECORD', 'VARIABLE'].includes(code)) throw new Error('未知对象组织形式。')
  const variable = code === 'VARIABLE'
  const entries = variable ? [uint(0, 'SamplePeriod', 16, 0x1234)] : [
    { subIndex: 0, name: '最高子索引', ...si0Protocol, value: 2, role: 'header' },
    uint(1, code === 'ARRAY' ? 'Channel 1' : 'Command', 16, 0x1234),
    uint(2, code === 'ARRAY' ? 'Channel 2' : 'Target', code === 'ARRAY' ? 16 : 32, code === 'ARRAY' ? 0x5678 : 0x78563412),
  ]
  return { code, index: { VARIABLE: 0x2000, ARRAY: 0x2001, RECORD: 0x2002 }[code], name: { VARIABLE: '单值参数', ARRAY: '通道参数', RECORD: '控制参数' }[code], source: 'teaching', declaredMaxSubIndex: variable ? 0 : 2, accessUpperSubIndex: variable ? 0 : 2, entries }
}

export const sdoRequestDefaults = Object.freeze({ mode: 'complete', operation: 'read', start: '0', completeSupported: true, permission: 'rw', state: 'PREOP' })
export const sdoLauncherEntries = ['complete-access-supported', 'coe-supported', 'sdo-res-interface']
