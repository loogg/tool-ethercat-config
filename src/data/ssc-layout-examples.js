const field = (name, bits, padding = false) => ({ name, bits, padding })
const example = (id, label, raw, aligned) => ({ id, label, raw: raw.map((field, i) => ({ ...field, id: `raw-${i}` })), aligned: aligned.map((field, i) => ({ ...field, id: `aligned-${i}` })) })

export const sscLayoutExamples = [
  example('bool-word', '3 × BOOL + UINT16', [field('BOOL1',1),field('BOOL2',1),field('BOOL3',1),field('UINT16',16)], [field('BOOL1',1),field('BOOL2',1),field('BOOL3',1),field('pad_5',5,true),field('pad_8',8,true),field('UINT16',16)]),
  example('byte-crossing', 'BIT5 + BIT4：跨字节', [field('BIT5',5),field('BIT4',4)], [field('BIT5',5),field('pad_3',3,true),field('BIT4',4),field('pad_4',4,true)]),
  example('byte-word', 'UINT8 + UINT16：WORD 起点', [field('UINT8',8),field('UINT16',16)], [field('UINT8',8),field('pad_8',8,true),field('UINT16',16)]),
  example('eight-bit', 'BIT4 + UINT8 + BIT4：8 bit 也受限', [field('BIT4_A',4),field('UINT8',8),field('BIT4_B',4)], [field('BIT4_A',4),field('pad_4',4,true),field('UINT8',8),field('BIT4_B',4),field('pad_4',4,true),field('pad_8',8,true)]),
  example('tail', '2 × BOOL：末尾块也需填满', [field('BOOL1',1),field('BOOL2',1)], [field('BOOL1',1),field('BOOL2',1),field('pad_6',6,true),field('pad_8',8,true)]),
]
