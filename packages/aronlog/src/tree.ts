import treeify from 'object-treeify'
import { mark } from './mark'

const tree = (object: JSON | object) => {
    console.log(
        treeify(parseObject(JSON.parse(JSON.stringify(object))), {
            spacerNeighbour: mark('.│  .'),
            keyNoNeighbour: mark('.└─ .'),
            keyNeighbour: mark('.├─ .'),
            separator: mark('.: .')
        })
    )
}

function parseObject(object) {
    for (const key in object) {
        const value = object[key]
        if (Array.isArray(value)) {
            object[key] = value
                .map((eachValue) => mark(`*${eachValue}*`))
                .join(mark('., .'))
        } else if (typeof value === 'object') {
            parseObject(value)
        } else {
            object[key] = mark(`*${value}*`)
        }
    }
    return object
}

export { tree }