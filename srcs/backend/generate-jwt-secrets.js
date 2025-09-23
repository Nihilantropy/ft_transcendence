#!/usr/bin/env node

/**
 * @brief JWT Secret Generator for ft_transcendence
 * @description Generate cryptographically secure JWT secrets for development and production
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

/**
 * Generate a secure random secret
 */
function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('base64')
}

/**
 * Generate secrets and update .env file
 */
function generateJwtSecrets() {
  console.log('🔐 Generating JWT Secrets for ft_transcendence...\n')
  
  // Generate new secrets
  const jwtSecret = generateSecret(64)
  const jwtRefreshSecret = generateSecret(64)
  
  console.log('Generated secrets:')
  console.log('==================')
  console.log(`JWT_SECRET="${jwtSecret}"`)
  console.log(`JWT_REFRESH_SECRET="${jwtRefreshSecret}"`)
  console.log('')
  
  // Check if .env file exists
  const envPath = path.join(process.cwd(), '.env')
  
  if (fs.existsSync(envPath)) {
    console.log('📝 Updating .env file...')
    
    let envContent = fs.readFileSync(envPath, 'utf8')
    
    // Update or add JWT secrets
    if (envContent.includes('JWT_SECRET=')) {
      envContent = envContent.replace(/JWT_SECRET="[^"]*"/, `JWT_SECRET="${jwtSecret}"`)
    } else {
      envContent += `\n# JWT Configuration\nJWT_SECRET="${jwtSecret}"\n`
    }
    
    if (envContent.includes('JWT_REFRESH_SECRET=')) {
      envContent = envContent.replace(/JWT_REFRESH_SECRET="[^"]*"/, `JWT_REFRESH_SECRET="${jwtRefreshSecret}"`)
    } else {
      envContent += `JWT_REFRESH_SECRET="${jwtRefreshSecret}"\n`
    }
    
    // Add JWT expiration settings if they don't exist
    if (!envContent.includes('JWT_EXPIRES_IN=')) {
      envContent += `JWT_EXPIRES_IN="15m"\n`
    }
    
    if (!envContent.includes('JWT_REFRESH_EXPIRES_IN=')) {
      envContent += `JWT_REFRESH_EXPIRES_IN="7d"\n`
    }
    
    fs.writeFileSync(envPath, envContent)
    console.log('✅ .env file updated successfully!')
  } else {
    console.log('⚠️ .env file not found. Please create one with these secrets.')
  }
  
  console.log('\n🚀 JWT secrets generated successfully!')
  console.log('Don\'t forget to restart your backend service to load the new secrets.')
}

// Security recommendations
function showSecurityTips() {
  console.log('\n🛡️ Security Recommendations:')
  console.log('=============================')
  console.log('1. Never commit JWT secrets to git')
  console.log('2. Use different secrets for development/production')
  console.log('3. Rotate secrets periodically in production')
  console.log('4. Keep secrets at least 32 characters long')
  console.log('5. Use environment variables (never hardcode)')
  console.log('6. Consider using a secrets management service in production')
}

// Run the generator
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    generateJwtSecrets()
    showSecurityTips()
  } catch (error) {
    console.error('❌ Error generating JWT secrets:', error.message)
    process.exit(1)
  }
}