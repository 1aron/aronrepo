const log = require('../dist/index.cjs').default

// log.x`string1 ${2} string3 ${4} string 5`

console.log('')
log`Catch ${'-clause-'} ${'+variable+'} ${'~type~'} ${'!annotation!'} ${'`must`'} be ${'*any*'} or ${'_unknown_'} if ${'/specified/'}. ${'.ts(1196).'}`

console.log('')
log`${'Header'} Body`
log`General logs`

console.log('')
log.i`${'change'} File change detected. ${'Starting'} incremental compilation...`
log.i`File change detected. ${'Starting'} incremental compilation...`
log.w`${'pack'} ${4} entries`

console.log('')
log.error`${'Type'} Cannot use import statement outside a module`

console.log('')
log.conflict`${'Version'} Custom elements cannot be defined again`

console.log('')
log.pass`${'Test'} ${3} cases`

console.log('')
log.check`Up to date, audited ${'*1076*'} packages in ${'.786ms.'}`

console.log('')
log.delete`Delete ${'-3-'} files`
log.add`Add ${'+3+'} files`

console.log('')
log.o`${'Valid commit format'} ${'"Fix(Compiler): Import user config file path problem"'}`
log.x`${'Invalid commit format'} ${'.Aron Conventional Commits.'}`

console.log('')
log.success`All files exported to desktop`
log.warn`${'Warn'} Same file name`
log.fail`Too many requests`

console.log('')
