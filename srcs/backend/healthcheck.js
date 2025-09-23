/**
 * @brief Health check script for Docker container
 * 
 * @description Simple health check that verifies the server is responding
 */

import http from 'http'

const options = {
  hostname: process.env.BACKEND_HOST || 'backend',
  port: process.env.BACKEND_PORT || 8000,
  path: '/health',
  method: 'GET',
  timeout: 2000
}

const healthCheck = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`)
  if (res.statusCode === 200) {
    process.exit(0)
  } else {
    process.exit(1)
  }
})

healthCheck.on('error', (err) => {
  console.error('Health check failed:', err.message)
  process.exit(1)
})

healthCheck.on('timeout', () => {
  console.error('Health check timeout')
  healthCheck.destroy()
  process.exit(1)
})

healthCheck.end()