// Runs automatically after `npm install` (the "prepare" script).
// Points git at the committed .githooks folder so the pre-commit test gate is active
// for everyone who clones the project, including friends who join later.
import { execSync } from 'node:child_process'
import { chmodSync, existsSync } from 'node:fs'

if (!existsSync('.git')) {
  console.log('[gala] No .git folder yet, skipping hook setup. Run "git init" then "npm run prepare".')
  process.exit(0)
}

try {
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' })
  try {
    chmodSync('.githooks/pre-commit', 0o755)
  } catch {
    // chmod is not needed on Windows
  }
  console.log('[gala] Pre-commit test gate enabled.')
} catch {
  console.log('[gala] Could not configure git hooks. Is git installed?')
}
