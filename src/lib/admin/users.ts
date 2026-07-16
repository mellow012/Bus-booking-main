import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

type GetAdminUsersOpts = {
  currentUser: { id: string; role?: string | null; companyId?: string | null };
  limit?: number;
  cursor?: string | null; // opaque cursor
  q?: string | null;
  role?: string | null;
  companyId?: string | null;
};

// cursor format: base64("<updatedAtIso>::<id>")
function encodeCursor(updatedAt: Date, id: string) {
  return Buffer.from(`${updatedAt.toISOString()}::${id}`).toString('base64');
}

function decodeCursor(cursor: string) {
  try {
    const s = Buffer.from(cursor, 'base64').toString('utf8');
    const [updatedAt, id] = s.split('::');
    return { updatedAt: new Date(updatedAt), id };
  } catch {
    return null;
  }
}

export async function getAdminUsers(opts: GetAdminUsersOpts) {
  const { currentUser, limit = 25, cursor, q, role, companyId } = opts;

  try {
    const take = Math.min(Math.max(limit, 1), 200);
    const where: any = {};

    if (role) where.role = role;

    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (currentUser.role === 'company_admin') {
      where.companyId = currentUser.companyId;
    } else if (companyId) {
      where.companyId = companyId;
    }

    // Keyset pagination: order by updatedAt desc, id desc
    const decoded = cursor ? decodeCursor(cursor) : null;
    if (decoded) {
      where.OR = [
        ...(where.OR || []),
        {
          updatedAt: { lt: decoded.updatedAt }
        },
        {
          updatedAt: decoded.updatedAt,
          id: { lt: decoded.id }
        }
      ];
    }

    // Fetch one extra to determine next cursor
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
        setupCompleted: true,
      },
      orderBy: [
        { updatedAt: 'desc' },
        { id: 'desc' }
      ],
      take: take + 1,
    });

    let nextCursor: string | null = null;
    let results = users;
    if (users.length > take) {
      const last = users[users.length - 2];
      // use the last real item (second to last) to form cursor
      const cursorItem = users[take - 1];
      nextCursor = encodeCursor(cursorItem.updatedAt, cursorItem.id);
      results = users.slice(0, take);
    }

    return { data: results, meta: { nextCursor, limit: take } };
  } catch (err) {
    await logger.logError('api', 'Failed to fetch admin users', err as any);
    throw err;
  }
}

export async function getAdminUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export default { getAdminUsers, getAdminUserById };
