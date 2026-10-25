import { collections } from '../data/navigation.js'
import { learningTopics } from '../data/learning.js'
import { calculatorLabels, getEntryScope, routeHash } from './library.js'

// Home is a navigation projection. Definitions and field rules keep their owners.
export const homeEntryOrder = ['concepts', 'SSC', 'APP', 'ESI']
export function homeModel(entries, recentIds = []) {
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const target = id => {
    const entry = byId.get(id)
    return entry ? { kind: 'entry', id, href: routeHash({ view: 'entry', id, ...getEntryScope(entry) }) } : null
  }
  const entrypoints = homeEntryOrder.map(id => {
    const collection = collections.find(item => item.id === id)
    return { id, title: id === 'APP' ? '应用对象字典' : id === 'ESI' ? 'ESI 设备描述' : collection.label, description: collection.description, target: target(collection.overview) }
  }).filter(item => item.target)
  const topics = learningTopics.map(topic => ({ id: topic.id, number: topic.number, title: topic.title, question: topic.question, target: target(topic.entryId) })).filter(item => item.target)
  const calculators = Object.entries(calculatorLabels).map(([id, title]) => ({ id, title, target: { kind: 'calculator', id, href: routeHash({ view: 'calculators', id }) } }))
  const recent = [...new Set(Array.isArray(recentIds) ? recentIds : [])].filter(id => byId.has(id)).slice(0, 4).map(id => {
    const entry = byId.get(id), collection = collections.find(item => item.id === entry.collection)
    return { id, title: entry.name, description: entry.title, collection: collection?.shortLabel || '', target: target(id) }
  })
  return { entrypoints, topics, calculators, recent }
}
