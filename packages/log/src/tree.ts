import treeify from 'object-treeify'
import { mark } from './mark'

const tree = (object: JSON | object) => {
    console.log(
        treeify(object, {
            spacerNeighbour: mark('.│  .'),
            keyNoNeighbour: mark('.└─ .'),
            keyNeighbour: mark('.├─ .'),
            separator: mark('.: .')
        })
    )
}

export { tree }