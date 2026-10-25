// Teaching definitions, not an extracted project workbook or generated SSC output.
const columns = 'BCDEFGHIJKLMNOP'.split('')
const row = (number, kind, values) => ({ number, kind, values: { ...Object.fromEntries(columns.map(key => [key, null])), ...values } })

export const basicApplicationExample = {
  id: 'direct-io', title: '普通应用 · 单体 I/O', filename: '单体 I/O 教学定义', sourceType: 'teaching',
  sheets: [{ id: 'Profile', name: 'Profile', role: 'application', metadata: [
    { name: 'Device Profile', value: 5001, cell: 'C1' }, { name: 'Modul Profile', value: 0, cell: 'C2' },
    { name: 'IndexIncrement', value: 0, cell: 'C3' }, { name: 'PdoIndexIncrement', value: 0, cell: 'C4' },
  ], rows: [
    row(12, 'object', { B: '0x6000', C: 'RECORD', F: 'Inputs', L: 'ro' }),
    row(13, 'member', { D: 1, E: 'BOOL', F: 'Input1', G: 'FALSE', L: 'ro', M: 'tx' }),
    row(14, 'member', { D: 2, E: 'BOOL', F: 'Input2', G: 'FALSE', L: 'ro', M: 'tx' }),
    row(17, 'object', { B: '0x7000', C: 'RECORD', F: 'Outputs', L: 'ro' }),
    row(18, 'member', { D: 1, E: 'BOOL', F: 'Output1', G: 'FALSE', L: 'rw', M: 'rx' }),
    row(19, 'member', { D: 2, E: 'BOOL', F: 'Output2', G: 'FALSE', L: 'rw', M: 'rx' }),
    row(23, 'object', { B: '0x2000', C: 'VARIABLE', E: 'UINT16', F: 'SamplePeriodMs', G: 10, K: 'S', L: 'rw', P: '应用参数教学示例；不是 PDO 活动映射。' }),
    row(26, 'object', { B: '0x2001', C: 'ARRAY', F: 'ChannelFilterTimeMs', L: 'ro' }),
    row(27, 'member', { D: 1, E: 'UINT16', G: 10, K: 'S', L: 'rw' }),
    row(28, 'member', { D: 2, E: 'UINT16', G: 20, K: 'S', L: 'rw' }),
  ] }],
}

export const singleModuleExample = {
  id: 'single-module', title: '模块化应用 · 单实例 I/O', filename: '单模块 Slot 教学定义', sourceType: 'teaching',
  sheets: [
    { id: 'Base_Device', name: 'Base_Device', role: 'base', metadata: [
      { name: 'Device Profile', value: 5001, cell: 'C1' }, { name: 'Modul Profile', value: 0, cell: 'C2' },
      { name: 'IndexIncrement', value: '0x10', cell: 'C3' }, { name: 'PdoIndexIncrement', value: '0x1', cell: 'C4' },
    ], rows: [
      row(12, 'object', { B: '0xF000', C: 'RECORD', F: 'Modular Device Profile', L: 'ro' }),
      row(13, 'member', { D: 1, E: 'UINT16', F: 'Index distance', G: '0x10', L: 'ro' }),
      row(14, 'member', { D: 2, E: 'UINT16', F: 'Maximum number of modules', G: 1, L: 'ro' }),
      row(16, 'object', { B: '0xF030', C: 'ARRAY', F: 'Configured Module Ident List', L: 'rw' }),
      row(17, 'member', { D: 1, E: 'UINT32', G: '0x4711', L: 'rw', P: '[Slotname: I/O Slot] [ModuleIds: 0x4711]' }),
    ] },
    { id: 'Digital_IO', name: 'Digital_IO', role: 'module', metadata: [
      { name: 'Device Profile', value: 5001, cell: 'C1' }, { name: 'Modul Profile', value: 0, cell: 'C2' },
      { name: 'Module Ident', value: '0x4711', cell: 'C3' }, { name: 'IndexIncrement', value: '0x10', cell: 'C4' },
      { name: 'PdoIndexIncrement', value: '0x1', cell: 'C5' },
    ], rows: basicApplicationExample.sheets[0].rows.filter(row => row.number <= 19).map(row => ({ ...row, values: { ...row.values } })) },
  ],
}
