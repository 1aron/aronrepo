import { mark } from 'aronlog'

export function markJoin(strings: string[]) {
    return strings
        .map((str) => mark(`*${str}*`))
        .join(mark('.\', \'.'))
}