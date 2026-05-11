'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Message {
  id: string;
  sender_id: string;
  sender_type: 'guest' | 'staff' | 'system';
  sender_name: string;
  content: string;
  message_type: 'text' | 'image' | 'quick_reply';
  created_at: string;
  read: boolean;
}

interface Conversation {
  id: string;
  room_number: string;
  guest_name: string;
  guest_id: string;
  booking_id: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  status: 'active' | 'resolved' | 'escalated';
}

const QUICK_REPLIES = [
  { id: '1', text: 'We will send someone right away.', category: 'service' },
  { id: '2', text: 'Your request has been noted.', category: 'acknowledgment' },
  { id: '3', text: 'Is there anything else we can help with?', category: 'followup' },
  { id: '4', text: 'Housekeeping will arrive in 15 minutes.', category: 'housekeeping' },
  { id: '5', text: 'Thank you for staying with us!', category: 'closing' },
];

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'resolved' | 'escalated'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/staff/messages', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to fetch conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (threadId: string) => {
    try {
      const res = await fetch(`/api/staff/messages/${threadId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch messages');
    }
  };

  const sendMessage = async (content: string) => {
    if (!selectedConversation || !content.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/staff/messages/${selectedConversation.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setNewMessage('');
        // Update conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? { ...c, last_message: content.trim(), last_message_time: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const escalateConversation = async () => {
    if (!selectedConversation) return;

    try {
      const res = await fetch(`/api/staff/messages/${selectedConversation.id}/escalate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id ? { ...c, status: 'escalated' as const } : c
          )
        );
        setSelectedConversation((prev) =>
          prev ? { ...prev, status: 'escalated' as const } : null
        );
      }
    } catch (err) {
      console.error('Failed to escalate');
    }
  };

  const resolveConversation = async () => {
    if (!selectedConversation) return;

    try {
      const res = await fetch(`/api/staff/messages/${selectedConversation.id}/resolve`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id ? { ...c, status: 'resolved' as const } : c
          )
        );
        setSelectedConversation((prev) =>
          prev ? { ...prev, status: 'resolved' as const } : null
        );
      }
    } catch (err) {
      console.error('Failed to resolve');
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (filterStatus === 'all') return true;
    return c.status === filterStatus;
  });

  const getStatusColor = (status: Conversation['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'resolved':
        return 'bg-gray-400';
      case 'escalated':
        return 'bg-red-500';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Conversations List */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">Guest Messages</h1>
          <div className="flex gap-2 mt-3">
            {(['all', 'active', 'resolved', 'escalated'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">💬</p>
              <p>No conversations</p>
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
                  <div className="relative">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-semibold">
                      {conv.guest_name[0]}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(
                        conv.status
                      )}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 truncate">
                        {conv.guest_name}
                      </p>
                      <span className="text-xs text-gray-400">
                        {formatTime(conv.last_message_time)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">Room {conv.room_number}</p>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {conv.last_message}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message Thread */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold">
                  {selectedConversation.guest_name[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {selectedConversation.guest_name}
                  </p>
                  <p className="text-sm text-gray-500">Room {selectedConversation.room_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    (window.location.href = `/staff/requests?room=${selectedConversation.room_number}`)
                  }
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                >
                  View Requests
                </button>
                {selectedConversation.status === 'active' && (
                  <>
                    <button
                      onClick={escalateConversation}
                      className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200"
                    >
                      Escalate
                    </button>
                    <button
                      onClick={resolveConversation}
                      className="px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200"
                    >
                      Resolve
                    </button>
                  </>
                )}
                {selectedConversation.status === 'escalated' && (
                  <span className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg">
                    Escalated to Manager
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {selectedConversation.status === 'active' && (
            <div className="bg-white border-t border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-2">Quick Replies</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply.id}
                    onClick={() => sendMessage(reply.text)}
                    disabled={sending}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {reply.text}
                  </button>
                ))}
              </div>

              {/* Message Input */}
              <div className="flex gap-3 mt-4">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(newMessage)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => sendMessage(newMessage)}
                  disabled={!newMessage.trim() || sending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-400">
            <p className="text-6xl mb-4">💬</p>
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm">Choose a guest message thread to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message }: { message: Message }) {
  const isGuest = message.sender_type === 'guest';
  const isSystem = message.sender_type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-gray-200 text-gray-600 text-xs px-4 py-2 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isGuest ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-md px-4 py-3 rounded-2xl ${
          isGuest
            ? 'bg-white text-gray-900 rounded-tl-none'
            : 'bg-blue-600 text-white rounded-tr-none'
        }`}
      >
        <p className="text-sm">{message.content}</p>
        <p
          className={`text-xs mt-1 ${
            isGuest ? 'text-gray-400' : 'text-blue-200'
          }`}
        >
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
