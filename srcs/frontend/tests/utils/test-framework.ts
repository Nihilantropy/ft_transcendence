/**
 * @brief Simple test framework for ft_transcendence frontend testing
 * 
 * @description Lightweight testing framework without external dependencies.
 * Provides basic test runner, assertions, and result tracking.
 */

export interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

export class TestFramework {
  private results: TestResult[] = []
  private suiteName: string

  constructor(suiteName: string) {
    this.suiteName = suiteName
  }

  async test(name: string, testFn: () => void | Promise<void>): Promise<void> {
    const startTime = performance.now()
    
    try {
      await testFn()
      const duration = performance.now() - startTime
      
      this.results.push({ name, passed: true, duration })
      console.log(`✅ ${name} (${duration.toFixed(1)}ms)`)
      
    } catch (error) {
      const duration = performance.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      this.results.push({ name, passed: false, error: errorMessage, duration })
      console.log(`❌ ${name}: ${errorMessage} (${duration.toFixed(1)}ms)`)
    }
  }

  assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(
        message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      )
    }
  }

  assertTrue(value: any, message?: string): void {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${JSON.stringify(value)}`)
    }
  }

  assertNotNull<T>(value: T, message?: string): asserts value is NonNullable<T> {
    if (value === null || value === undefined) {
      throw new Error(message || `Expected non-null value, got ${JSON.stringify(value)}`)
    }
  }

  printSummary(): void {
    const total = this.results.length
    const passed = this.results.filter(r => r.passed).length
    const failed = total - passed
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0)
    
    console.log(`\n📊 Test Suite: ${this.suiteName}`)
    console.log(`⏱️  Total Time: ${totalDuration.toFixed(1)}ms`)
    console.log(`📈 Results: ${passed}/${total} passed (${total > 0 ? (passed/total*100).toFixed(1) : 0}%)`)
    
    if (failed > 0) {
      console.log(`\n❌ Failed Tests:`)
      this.results
        .filter(t => !t.passed)
        .forEach(t => console.log(`   • ${t.name}: ${t.error}`))
    }
    
    if (failed === 0) {
      console.log('🎉 All tests passed!')
    }
  }

  getSuiteResults() {
    const total = this.results.length
    const passed = this.results.filter(r => r.passed).length
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0)
    
    return {
      suiteName: this.suiteName,
      tests: [...this.results],
      totalDuration,
      summary: {
        total,
        passed,
        failed: total - passed,
        passRate: total > 0 ? (passed / total) * 100 : 0
      }
    }
  }
}