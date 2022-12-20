/* eslint-disable no-irregular-whitespace */
import { execSync } from 'child_process'
import dedent from 'dedent'

test('bump to specific version by analyzing dependencies', () => {
    const outputLog = execSync('node ../dist/bin/index version 1.2.0 --list',
        { cwd: __dirname, stdio: 'pipe' })
        .toString()
    expect(outputLog).toContain(dedent`
      📦
      ├─ a
      │  └─ dependencies
      │     └─ b
      ├─ b
      └─ c
         └─ peerDependencies
            └─ a
      ⏺ Success bump version to ^1.2.0 for 3 packages in all workspace
    `)
})