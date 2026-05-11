'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  id: string;
  sender_id: string;
  sender_type: 'guest' | 'staff';
  sender_name: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  created_at: string;
  read: boolean;
}

interface Conversation {
  id: string;
  room_number: string;
  guest_name: string;
  guest_id: string;
  booking_id: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
}

interface QuickReply {
  id: string;
  text: string;
  category: string;
}

const QUICK_REPLIES: QuickReply[] = [
  { id: '1', text: 'We are on it!', category: 'general' },
  { id: '2', text: 'Housekeeping will arrive shortly', category: 'housekeeping' },
  { id: '3', text: 'Your request has been noted', category: 'general' },
  { id: '4', text: 'Is there anything else we can help with?', category: 'general' },
  { id: '5', text: 'Thank you for your patience', category: 'general' },
  { id: '6', text: 'Maintenance has been dispatched', category: 'maintenance' },
  { id: '7', text: 'Room service is on the way', category: 'room_service' },
];

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchConversations();
    setupWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const setupWebSocket = () => {
    // WebSocket connection for real-time messages
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/staff/ws`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message' && selectedConversation?.id === data.conversationId) {
          setMessages((prev) => [...prev, data.message]);
          markMessageAsRead(data.message.id);
        } else if (data.type === 'new_message') {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === data.conversationId
                ? { ...c, unread_count: c.unread_count + 1, last_message: data.message.content }
                : c
            )
          );
        }
      };

      wsRef.current.onerror = () => {
        console.error('WebSocket error - falling back to polling');
      };
    } catch {
      console.error('WebSocket not available - using polling');
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/staff/messages', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/staff/messages/${conversationId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const res = await fetch(`/api/staff/messages/${selectedConversation.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim() }),
      });

      if (!res.ok) throw new Error('Failed to send message');

      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setNewMessage('');

      // Update conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? { ...c, last_message: newMessage.trim(), last_message_time: new Date().toISOString() }
            : c
        )
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await fetch(`/api/staff/messages/read/${messageId}`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Silent fail
    }
  };

  const escalateToManager = async () => {
    if (!selectedConversation) return;

    try {
      const res = await fetch(`/api/staff/messages/${selectedConversation.id}/escalate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to escalate');
      alert('Conversation escalated to manager');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const markAsResolved = async () => {
    if (!selectedConversation) return;

    try {
      const res = await fetch(`/api/staff/messages/${selectedConversation.id}/resolve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to resolve');
      setConversations((prev) => prev.filter((c) => c.id !== selectedConversation.id));
      setSelectedConversation(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const useQuickReply = (text: string) => {
    setNewMessage(text);
  };

  const filteredConversations = conversations.filter((c) =>
    c.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.room_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Conversations List */}
      <div className={`${selectedConversation ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 border-r border-gray-200 bg-white`}>
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Guest Messages</h2>
          <input
            type="text"
            placeholder="Search by name or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold">
                    {conv.guest_name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 truncate">{conv.guest_name}</p>
                      <span className="text-xs text-gray-400">
                        {formatTime(conv.last_message_time)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Room {conv.room_number}</p>
                    {conv.last_message && (
                      <p className="text-sm text-gray-500 truncate mt-1">{conv.last_message}</p>
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Chat Header */}
          <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold">
                {selectedConversation.guest_name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-900">{selectedConversation.guest_name}</p>
                <p className="text-xs text-gray-500">Room {selectedConversation.room_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={escalateToManager}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Escalate
              </button>
              <button
                onClick={markAsResolved}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Resolve
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
              <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_type === 'staff' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    message.sender_type === 'staff'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.sender_type === 'staff' ? 'text-blue-100' : 'text-gray-400'
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          <div className="bg-white border-t border-gray-200 p-3">
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_REPLIES.slice(0, 4).map((reply) => (
                <button
                  key={reply.id}
                  onClick={() => useQuickReply(reply.text)}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {reply.text}
                </button>
              ))}
            </div>

            {/* Message Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={sending}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💬</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900">Select a conversation</h3>
            <p className="text-sm text-gray-500 mt-1">Choose a guest to start messaging</p>
          </div>
        </div>
      )}
    </div>
  );
}
