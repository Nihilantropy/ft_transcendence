/**
 * @file User schema definition
 * @description JSON schema for user object used in various route schemas
 */
export default [
    {
        $id: 'User',
        type: 'object',
        properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            email_verified: { type: 'boolean' },
            avatar: { type: 'string', description: 'User avatar URL' },
            is_online: { type: 'boolean', description: 'User online status' },
            twoFactorEnabled: { type: 'boolean', description: 'Two-factor authentication status' }
        },
        required: ['id']
    }
]