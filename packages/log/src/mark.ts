import chalk from 'chalk'

export function mark(event: string) {
    const newSlot = event
        .toString()
        .replace(/^\*(.*?)\*$/g, chalk.cyan('$1'))
        .replace(/^_(.*?)_$/g, chalk.underline('$1'))
        .replace(/^\/(.*?)\/$/g, chalk.italic('$1'))
        .replace(/^-(.*?)-$/g, chalk.red('$1'))
        .replace(/^~(.*?)~$/g, chalk.strikethrough('$1'))
        .replace(/^!(.*?)!$/g, chalk.yellow('$1'))
        .replace(/^\+(.*?)\+$/g, chalk.green('$1'))
        .replace(/^\.(.*?)\.$/g, chalk.dim('$1'))
        .replace(/^`(.*?)`$/g, chalk.cyan('`$1`'))
    return newSlot
}