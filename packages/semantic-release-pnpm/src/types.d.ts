declare module '@semantic-release/error' {
    export default class SemanticReleaseError extends Error {
        code: string
        details: string

        constructor(message: string, code: string, details: string)
    }
}
