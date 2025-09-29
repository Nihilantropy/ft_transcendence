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
            email_verified: { type: 'boolean' }
        },
        required: ['id', 'username', 'email', 'email_verified']
    }
]