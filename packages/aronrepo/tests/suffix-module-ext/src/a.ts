export * from './b'
export * from './d'
export * from '.'
import { dIndex } from './d'
import { ff } from './f/ff'
console.log(dIndex, ff);
(() => import('./c'))()