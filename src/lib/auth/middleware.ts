import { NextRequest } from 'next/server';
import * as jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface AuthUser {
  sub: string;
  role: Role;
}

const publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';

/**
 * Extracts and verifies the JWT from the Authorization header.
 * Returns the decoded user payload or null if invalid/missing.
 */
export function authenticateUser(req: NextRequest): AuthUser | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  
  if (!publicKey) {
    console.error('JWT_PUBLIC_KEY is not defined');
    return null;
  }

  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Checks if the user's role is in the allowed list of roles.
 */
export function requireRole(user: AuthUser, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(user.role);
}

/**
 * Checks if the user owns the resource or is an admin.
 */
export function verifyOwnership(user: AuthUser, ownerId: string): boolean {
  if (user.role === 'admin') {
    return true;
  }
  return user.sub === ownerId;
}
