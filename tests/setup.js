import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Slow machines need longer than the 1s default when a test waits for something to appear.
configure({ asyncUtilTimeout: 5000 })