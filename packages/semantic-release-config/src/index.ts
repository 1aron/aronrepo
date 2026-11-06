import configure from './configure'

export { default as configure } from './configure'
export { default as rules, createReleaseRules } from './rules'
export { analyzeCommits, type AnalyzerConfig } from './analyzer'

export default configure()
