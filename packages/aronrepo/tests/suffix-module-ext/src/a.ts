export * from './b'
export * from './d'
export * from '.'
import { dIndex } from './d'
console.log(dIndex);
(() => import('./c'))()