import chalk from 'chalk'

export function getTime() {
    return chalk.dim(new Date().toLocaleTimeString('en', { hour12: false }))
}