import './load-root-env'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { normalizeEmail, normalizeUsername, prisma } from '@madstoq/database'

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
if (!authSecret) {
  throw new Error(
    'AUTH_SECRET is missing. Add it to the repo root .env (see .env.example). Generate: openssl rand -base64 32'
  )
}

const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
if (authUrl) {
  process.env.AUTH_URL = authUrl
  process.env.NEXTAUTH_URL = authUrl
}

/**
 * Secure cookie names only work on HTTPS.
 * Leave this unset when AUTH_URL is absent so Auth.js follows the request
 * (https://madstoq.com uses __Secure- cookies, http://localhost does not).
 */
const useSecureCookies = authUrl ? authUrl.startsWith('https://') : undefined

/** Auth.js session layer using app-managed credentials (Neon/Prisma). */
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  trustHost: true,
  ...(useSecureCookies === undefined ? {} : { useSecureCookies }),
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Username or email and password',
      credentials: {
        username: { label: 'Username', type: 'text' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        try {
          const password = credentials?.password as string | undefined
          if (!password) return null

          const usernameRaw = credentials?.username as string | undefined
          const emailRaw = credentials?.email as string | undefined
          const username = usernameRaw?.trim() ? normalizeUsername(usernameRaw) : ''
          const email = emailRaw?.trim() ? normalizeEmail(emailRaw) : ''

          if (!username && !email) return null

          const user = username
            ? await prisma.user.findFirst({
                where: { username, isActive: true },
              })
            : await prisma.user.findFirst({
                where: { email, isActive: true },
              })

          if (!user?.passwordHash) return null

          const ok = await compare(password, user.passwordHash)
          if (!ok) return null

          return {
            id: user.id,
            email: user.email,
          }
        } catch (err) {
          console.error('[auth] authorize failed', err)
          throw err
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { accessToken?: string; refreshToken?: string; id?: string; email?: string | null }
        token.accessToken = u.accessToken
        token.refreshToken = u.refreshToken
        token.sub = u.id
        if (u.email != null) token.email = u.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
        session.user.email = (token.email as string | null | undefined) ?? session.user.email ?? null
      }
      session.accessToken = typeof token.accessToken === 'string' ? token.accessToken : undefined
      session.refreshToken = typeof token.refreshToken === 'string' ? token.refreshToken : undefined
      return session
    },
  },
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
})
