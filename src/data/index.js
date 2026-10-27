import { sscEntries } from './ssc.js'
import { dictionaryEntries } from './dictionary.js'
import { esiEntries } from './esi.js'
import { navigationEntries, getEntryNavigation } from './navigation.js'
import { learningEntries, legacyLearningTargets } from './learning.js'

const identityLabels = { 'coe-device-name': 'DEVICE_NAME', 'coe-hardware-version': 'DEVICE_HW_VERSION', 'coe-software-version': 'DEVICE_SW_VERSION', 'coe-identity': 'Identity字段对照' }
const decorate = (items, origin) => items.map(entry => ({ ...entry, ...getEntryNavigation(entry, origin),
  ...(identityLabels[entry.id] ? { name: identityLabels[entry.id], aliases: [...(entry.aliases || []), entry.name] } : {}),
  nodeKind: entry.overview ? 'overview' : origin === 'dictionary' && entry.sources[0]?.kind !== 'XLSX' ? /0x[0-9a-f]{4}/i.test(entry.name) && entry.sources[0]?.kind === 'CoE' ? 'object' : 'concept' : 'config',
}))
const dictionary = decorate(dictionaryEntries, 'dictionary').map(entry => entry.collection === 'concepts' ? { ...entry, group: legacyLearningTargets[entry.id]?.topic || '' } : entry)
export const entries = [
  navigationEntries.find(entry => entry.id === 'ssc-overview'),
  ...decorate(sscEntries, 'ssc'),
  navigationEntries.find(entry => entry.id === 'ssc-compiler-overview'),
  navigationEntries.find(entry => entry.id === 'application-overview'),
  ...dictionary.filter(entry => entry.collection === 'APP'),
  navigationEntries.find(entry => entry.id === 'esi-overview'),
  ...decorate(esiEntries, 'esi'),
  ...learningEntries,
  ...dictionary.filter(entry => entry.collection === 'concepts'),
]
export const entryMap = new Map(entries.map(entry => [entry.id, entry]))
