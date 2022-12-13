# Contributing to Aronrepo

## Developing
Split a new terminal and run `npm run dev` in the project root to watch all packages change and build:
```bash
npm run dev
```
Split a new terminal and switch to the target directory for testing to avoid running tests from other packages:
```bash
cd packages/target
```
```bash
npm run test -- --watch
```

## Checking
You have to pass `npm run check` before submitting a pull request. The command for `test` `lint` `type-check` `commit-check`
```bash
npm run check
```

### Test
```bash
npm run test
```

### Lint
```bash
npm run lint
```

### Type Check
```bash
npm run type-check
```

### Commit Check
```bash
npm run commit-check
```

### Build
```
npm run build
```