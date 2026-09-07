'use server'

import prisma from '../prisma';
import { getCurrentUserFromServer } from '@/lib/auth-utils';

/**
 * --- Team Messaging ---
 */
export async function getStaffMembers(companyId: string, excludeUserId: string) {
  try {
    const staff = await prisma.user.findMany({
      where: {
        companyId,
        id: { not: excludeUserId },
        role: { in: ['operator', 'conductor', 'company_admin'] },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      }
    });
    return { success: true, data: staff };
  } catch (error: unknown) {
    console.error('Error fetching staff members:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getConversations(userId: string) {
  const authUser = await getCurrentUserFromServer();
  if (!authUser) {
    return { success: false, error: 'Unauthorized' };
  }
  if (userId !== authUser.id) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: userId }
        }
      },
      include: {
        participants: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    return { success: true, data: conversations };
  } catch (error: unknown) {
    console.error('Error fetching conversations:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function createConversation(data: {
  companyId: string;
  participantIds: string[];
  name?: string;
  isBroadcast?: boolean;
}) {
  const authUser = await getCurrentUserFromServer();
  if (!authUser) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!data.participantIds.includes(authUser.id)) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const participants = await prisma.user.findMany({
      where: { id: { in: data.participantIds } },
      select: { id: true, companyId: true },
    });
    if (
      participants.length !== data.participantIds.length ||
      participants.some((participant) => participant.companyId !== data.companyId)
    ) {
      return { success: false, error: 'Forbidden' };
    }

    // If it's a 1-to-1, check if it already exists
    if (!data.isBroadcast && data.participantIds.length === 2) {
      const existing = await prisma.conversation.findFirst({
        where: {
          isBroadcast: false,
          AND: [
            { participants: { some: { id: data.participantIds[0] } } },
            { participants: { some: { id: data.participantIds[1] } } }
          ]
        },
        include: {
          participants: true
        }
      });
      if (existing) return { success: true, data: existing };
    }

    const conversation = await prisma.conversation.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        isBroadcast: data.isBroadcast || false,
        participants: {
          connect: data.participantIds.map(id => ({ id }))
        }
      },
      include: {
        participants: true
      }
    });
    return { success: true, data: conversation };
  } catch (error: unknown) {
    console.error('Error creating conversation:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function sendMessage(data: {
  conversationId: string;
  senderId: string;
  content?: string;
  mediaPath?: string;
  mediaType?: string;
}) {
  const authUser = await getCurrentUserFromServer();
  if (!authUser) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: data.conversationId,
        participants: { some: { id: authUser.id } },
      },
      select: { id: true },
    });
    if (!conversation) {
      return { success: false, error: 'Forbidden' };
    }

    const message = await prisma.chatMessage.create({
      data: {
        conversationId: data.conversationId,
        senderId: authUser.id,
        content: data.content,
        mediaPath: data.mediaPath,
        mediaType: data.mediaType,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    // Update conversation updatedAt
    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() }
    });

    return { success: true, data: message };
  } catch (error: unknown) {
    console.error('Error sending message:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getMessages(conversationId: string, limit = 50) {
  const authUser = await getCurrentUserFromServer();
  if (!authUser) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { id: authUser.id } },
      },
      select: { id: true },
    });
    if (!conversation) {
      return { success: false, error: 'Forbidden' };
    }

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          }
        }
      }
    });
    return { success: true, data: messages.reverse() };
  } catch (error: unknown) {
    console.error('Error fetching messages:', error);
    return { success: false, error: (error as Error).message };
  }
}
