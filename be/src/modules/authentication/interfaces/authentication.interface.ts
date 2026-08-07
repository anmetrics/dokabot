import { UserRole } from 'generated/prisma';

export type AuthenticationPayload = {
  /** User id. */
  sub: string;
  email: string;
  role: UserRole;
};

/** Shape attached to `request.user` by the JWT strategy. */
export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type RequestContext = {
  ip?: string;
  userAgent?: string;
};
