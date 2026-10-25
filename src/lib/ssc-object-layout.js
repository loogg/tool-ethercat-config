import { calculateBitLayout } from './calculations.js'

/** ET9300 V1.10 §7.1: a given local-object member sequence at a WORD boundary.
 * No padding is inserted; this is not a validator for EtherCAT PDO bitstreams.
 */
export function analyzeSscObjectLayout(fields) {
  // Local entry BitLength is UINT16 (§7.3), unlike the 8bit PDO mapping length.
  const layout = calculateBitLayout(fields, { maxFieldBits: 65535 })
  layout.rows = layout.rows.map((row, i) => ({ ...row, padding: Boolean(fields[i].padding) }))
  const issues = [], groups = []
  let group = null
  const issue = (code, rows, message) => issues.push({ code, rowIds: rows.map(row => row.id), message })
  function finishSmallGroup() {
    if (!group) return
    const length = group.rows.reduce((sum, row) => sum + row.bitLength, 0)
    const start = group.rows[0].bitOffset
    if (start % 16 !== 0) issue('small-group-start', group.rows, `小成员组从 bit ${start} 开始，不是 WORD 起点。`)
    if (length % 16 !== 0) issue('small-group-incomplete', group.rows, `小成员组共 ${length} bit，未填满完整的 16 bit 块；还差 ${16 - length % 16} bit。`)
    groups.push({ start, bits: length, rowIds: group.rows.map(row => row.id) })
    group = null
  }
  for (const row of layout.rows) {
    if (row.bitLength <= 8) {
      group ||= { rows: [] }
      group.rows.push(row)
      if (row.smallFieldCrossesByte) issue('small-crosses-byte', [row], `${row.name}：${row.bitLength} bit 从字节内 bit ${row.bitInByte} 开始，跨越字节边界。`)
    } else {
      finishSmallGroup()
      if (row.largeFieldUnalignedWord) issue('large-not-word', [row], `${row.name}：${row.bitLength} bit 从 bit ${row.bitOffset} 开始，须从整 WORD 偏移开始。`)
    }
  }
  finishSmallGroup()
  return { layout, issues, groups, empty: layout.rows.length === 0, valid: layout.rows.length > 0 && issues.length === 0 }
}
