import { commits } from '@aronrepo/conventional-commits'
import parserOpts from './parser-opts'

const recommendedBumpOpts = {
    parserOpts,
    whatBump(parsedCommits: Array<{ type?: string }>) {
        let level: 0 | 1 | 2 | null = null
        let major = 0
        let minor = 0
        let patch = 0

        for (const parsedCommit of parsedCommits) {
            const rule = commits.find(({ type }) => type === parsedCommit.type)
            if (!rule) continue
            switch (rule.release) {
                case 'major':
                    level = 0
                    major++
                    break
                case 'minor':
                    if (level !== 0) level = 1
                    minor++
                    break
                case 'patch':
                    if (level === null) level = 2
                    patch++
                    break
            }
        }

        return {
            level,
            reason: `Major: ${major}, Minor: ${minor}, Patch: ${patch}`
        }
    }
}

export default recommendedBumpOpts
