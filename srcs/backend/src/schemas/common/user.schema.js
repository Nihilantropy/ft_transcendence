/**
 * @file User schema definition
 * @description JSON schema for user object used in various route schemas
 * @note Uses camelCase to match frontend expectations and user formatters
 */
export default [
    {
        $id: 'User',
        type: 'object',
        properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            emailVerified: { type: 'boolean', description: 'Email verification status' },
            avatar: { type: ['string', 'null'], description: 'User avatar base64 or null' },
            isOnline: { type: 'boolean', description: 'User online status' },
            twoFactorEnabled: { type: 'boolean', description: 'Two-factor authentication status' },
            lastSeen: { type: ['string', 'null'], description: 'Last seen timestamp' },
            createdAt: { type: ['string', 'null'], description: 'Account creation timestamp' },
            updatedAt: { type: ['string', 'null'], description: 'Last update timestamp' }
        },
        required: ['id', 'username', 'email', 'emailVerified', 'twoFactorEnabled']
    }
]