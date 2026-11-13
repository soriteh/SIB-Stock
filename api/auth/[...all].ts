import { toNodeHandler } from 'better-auth/node'
import { auth } from '../../src/server/auth'

// Better Auth handles /api/auth/* using the Vercel Node.js runtime.
export default toNodeHandler(auth)
