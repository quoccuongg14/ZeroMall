import { apiRequest } from './api.service';
import { API_BASE_URL } from '../config/api.config';
import { io } from 'socket.io-client';

export interface ChatConversation {
  id: string;
  buyerId: string;
  shopId: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadBuyerCount: number;
  unreadShopCount: number;
  createdAt: string;
  updatedAt: string;
  shopInfo?: {
    name: string;
    logo?: string;
  };
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'BUYER' | 'SHOP' | 'SYSTEM';
  type: 'TEXT' | 'IMAGE' | 'PRODUCT_CARD' | 'ORDER_CARD';
  content: string;
  metadata?: any;
  isRead: boolean;
  createdAt: string;
}

export async function getOrCreateConversation(buyerId: string, shopId: string) {
  return apiRequest<ChatConversation>('/chat/conversations', {
    method: 'POST',
    body: JSON.stringify({ buyerId, shopId }),
  });
}

export async function fetchConversations(filter: { buyerId?: string; shopId?: string }) {
  const query = new URLSearchParams();
  if (filter.buyerId) query.append('buyerId', filter.buyerId);
  if (filter.shopId) query.append('shopId', filter.shopId);

  return apiRequest<ChatConversation[]>(`/chat/conversations?${query.toString()}`);
}

export async function fetchMessages(conversationId: string, limit = 50, offset = 0) {
  return apiRequest<{
    conversation: ChatConversation;
    messages: ChatMessage[];
  }>(`/chat/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`);
}

export async function sendChatMessage(data: {
  conversationId: string;
  senderId: string;
  senderType: 'BUYER' | 'SHOP';
  type?: 'TEXT' | 'IMAGE' | 'PRODUCT_CARD' | 'ORDER_CARD';
  content: string;
  metadata?: any;
}) {
  return apiRequest<ChatMessage>('/chat/messages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function markConversationRead(conversationId: string, userType: 'BUYER' | 'SHOP') {
  return apiRequest<{ success: boolean }>(`/chat/conversations/${conversationId}/read`, {
    method: 'PATCH',
    body: JSON.stringify({ userType }),
  });
}

export function createChatSocket() {
  const explicitUrl = import.meta.env.VITE_CHAT_SOCKET_URL;
  if (explicitUrl) {
    return io(explicitUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  const host = typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  const socketUrl = isLocalHost ? `http://${host}:3007/chat` : `${API_BASE_URL}/chat`;
  return io(socketUrl, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
}
