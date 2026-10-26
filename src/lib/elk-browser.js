import ELK from 'elkjs/lib/elk-api.js'
import workerUrl from 'elkjs/lib/elk-worker.min.js?url'

export function createEngine() {
  return new ELK({ workerFactory: () => new Worker(workerUrl) })
}
