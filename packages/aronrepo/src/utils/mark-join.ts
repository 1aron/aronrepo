import { paint } from 'aronlog'

export function markJoin(strings: string[]) {
    return strings
        .map((str) => paint(`**${str}**`))
        .join(paint('..\', \'..'))
}