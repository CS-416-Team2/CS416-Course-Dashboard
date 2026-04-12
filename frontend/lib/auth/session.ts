import { auth } from "@/auth";
import { getUserSessionMeta } from "@/lib/auth/users";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireActiveSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  const userId = Number.parseInt(session.user.id, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new UnauthorizedError();
  }

  const currentMeta = await getUserSessionMeta(userId);
  if (!currentMeta?.isActive) {
    throw new ForbiddenError();
  }

  if (currentMeta.sessionVersion !== session.user.sessionVersion) {
    throw new ForbiddenError("Session has been rotated. Please sign in again.");
  }

  return {
    userId,
    email: session.user.email,
    name: session.user.name,
  };
}
