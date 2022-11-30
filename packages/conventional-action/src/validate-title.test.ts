const validateTitle = require('./validate-title')
const installPreset = require('./install-preset')

const preset = 'conventional-changelog-conventionalcommits'

// Install preset (takes some time)
jest.setTimeout(30000)
beforeAll(async () => {
    return new Promise(resolve => {
        resolve(installPreset(preset))
    })
})

it('detects valid PR titles', async () => {
    const inputs = [
        'Fix: Fix bug',
        'Fix: Fix bug\n\nBREAKING CHANGE: Fix bug',
        'Feat: Add feature',
        'Feat: Add feature\n\nBREAKING CHANGE: Add feature',
        'Refactor: Internal cleanup',
        'Feat: Add feature with breaking change'
    ]

    for (let index = 0; index < inputs.length; index++) {
        const input = inputs[index]
        await validateTitle(input)
    }
})

it('throws for PR titles without a type', async () => {
    await expect(validateTitle('Fix bug')).rejects.toThrow(
        /No release type found in pull request title "Fix bug"./
    )
})

it('throws for PR titles with an unknown type', async () => {
    await expect(validateTitle('Foo: Bar')).rejects.toThrow(
        /Unknown release type "Foo" found in pull request title "Foo: Bar"./
    )
})
