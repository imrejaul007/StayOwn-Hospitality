import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Send,
  MessageSquare,
  Clock,
  CheckCircle,
  User,
  Paperclip,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { formatDate, formatTime } from '../../utils/formatters';
import toast from 'react-hot-toast';

interface BookingConversationModalProps {
  booking: {
    _id: string;
    bookingNumber: string;
    checkIn: string;
    checkOut: string;
    status: string;
  };
  isOpen: boolean;
  onClose: () => void;
  existingConversationId?: string;
}

interface Message {
  messageId: string;
  sender: {
    userId: string;
    role: string;
    name: string;
  };
  messageType: string;
  content: string;
  attachments?: unknown[];
  sentAt: string;
  status: string;
  readBy: unknown[];
}

interface Conversation {
  _id: string;
  conversationId: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  participants: unknown[];
  messages: Message[];
  statistics: {
    messageCount: number;
    lastMessageAt: string;
  };
}

export default function BookingConversationModal({
  booking,
  isOpen,
  onClose,
  existingConversationId
}: BookingConversationModalProps) {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newConversationData, setNewConversationData] = useState({
    subject: '',
    category: 'general_inquiry',
    priority: 'normal'
  });
  const [isCreatingConversation, setIsCreatingConversation] = useState(!existingConversationId);

  // Get existing conversation or conversations for this booking
  const { data: conversationData, isLoading } = useQuery({
    queryKey: ['conversation', existingConversationId || booking._id],
    queryFn: async () => {
      if (existingConversationId) {
        const response = await bookingService.getConversation(existingConversationId);
        return response.data.conversation;
      } else {
        const response = await bookingService.getConversations({ bookingId: booking._id });
        return response.data.conversations?.[0] || null;
      }
    },
    enabled: isOpen
  });

  const conversation: Conversation | null = conversationData;

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: async (data: {
      subject: string;
      initialMessage: string;
      category: string;
      priority: string;
    }) => {
      return await bookingService.createConversation(
        booking._id,
        data.subject,
        data.initialMessage,
        data.category,
        data.priority
      );
    },
    onSuccess: () => {
      toast.success('Conversation started successfully');
      setIsCreatingConversation(false);
      setNewConversationData({ subject: '', category: 'general_inquiry', priority: 'normal' });
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    },
    onError: (error: unknown) => {
      toast.error(error.response?.data?.message || 'Failed to start conversation');
    }
  });

  // Send message to existing conversation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversation) throw new Error('No conversation found');
      return await bookingService.addMessageToConversation(conversation._id, content);
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    },
    onError: (error: unknown) => {
      toast.error(error.response?.data?.message || 'Failed to send message');
    }
  });

  // Mark messages as read
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!conversation) return;
      return await bookingService.markConversationAsRead(conversation._id);
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  // Mark messages as read when conversation opens
  useEffect(() => {
    if (conversation && isOpen) {
      markAsReadMutation.mutate();
    }
  }, [conversation?._id, isOpen]);

  const handleCreateConversation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConversationData.subject.trim() || !newMessage.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    createConversationMutation.mutate({
      subject: newConversationData.subject,
      initialMessage: newMessage,
      category: newConversationData.category,
      priority: newConversationData.priority
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    sendMessageMutation.mutate(newMessage);
  };

  const getMessageStatusIcon = (message: Message) => {
    if (message.status === 'read') {
      return <CheckCircle className="w-3 h-3 text-green-500" />;
    } else if (message.status === 'delivered') {
      return <CheckCircle className="w-3 h-3 text-blue-500" />;
    } else {
      return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'normal':
        return 'text-blue-600 bg-blue-50';
      case 'low':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'resolved':
        return 'text-blue-600 bg-blue-50';
      case 'closed':
        return 'text-gray-600 bg-gray-50';
      case 'escalated':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        conversation
          ? `${conversation.subject} (${conversation.conversationId})`
          : 'Start New Conversation'
      }
      className="max-w-4xl max-h-[90vh] flex flex-col"
    >
      <div className="flex flex-col h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-medium text-gray-900">
                  Booking #{booking.bookingNumber}
                </h3>
                <p className="text-sm text-gray-600">
                  {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                </p>
              </div>
            </div>
            {conversation && (
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(conversation.priority)}`}>
                  {conversation.priority.toUpperCase()}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(conversation.status)}`}>
                  {conversation.status.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}

        {!isLoading && isCreatingConversation && (
          <form onSubmit={handleCreateConversation} className="p-4 space-y-4 border-b">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject *
              </label>
              <Input
                value={newConversationData.subject}
                onChange={(e) => setNewConversationData({
                  ...newConversationData,
                  subject: e.target.value
                })}
                placeholder="What would you like to discuss?"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={newConversationData.category}
                  onChange={(e) => setNewConversationData({
                    ...newConversationData,
                    category: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="general_inquiry">General Inquiry</option>
                  <option value="booking_modification">Booking Modification</option>
                  <option value="complaint">Complaint</option>
                  <option value="compliment">Compliment</option>
                  <option value="special_request">Special Request</option>
                  <option value="billing_question">Billing Question</option>
                  <option value="service_request">Service Request</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={newConversationData.priority}
                  onChange={(e) => setNewConversationData({
                    ...newConversationData,
                    priority: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </form>
        )}

        {/* Messages */}
        {conversation && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversation.messages.map((message) => (
              <div
                key={message.messageId}
                className={`flex ${
                  message.sender.role === 'guest' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.sender.role === 'guest'
                      ? 'bg-blue-600 text-white'
                      : message.messageType === 'system'
                      ? 'bg-gray-100 text-gray-600 text-center italic'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.messageType !== 'system' && (
                    <div className="flex items-center space-x-2 mb-1">
                      <User className="w-3 h-3" />
                      <span className="text-xs font-medium">
                        {message.sender.name} ({message.sender.role})
                      </span>
                    </div>
                  )}
                  <p className="text-sm">{message.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs opacity-75">
                      {formatTime(message.sentAt)}
                    </span>
                    {message.sender.role === 'guest' && (
                      <div className="ml-2">
                        {getMessageStatusIcon(message)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Message Input */}
        <div className="p-4 border-t">
          <form
            onSubmit={isCreatingConversation ? handleCreateConversation : handleSendMessage}
            className="flex space-x-2"
          >
            <div className="flex-1">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={
                  isCreatingConversation
                    ? "Type your message to start the conversation..."
                    : "Type your message..."
                }
                disabled={createConversationMutation.isPending || sendMessageMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              disabled={
                !newMessage.trim() ||
                createConversationMutation.isPending ||
                sendMessageMutation.isPending ||
                (isCreatingConversation && !newConversationData.subject.trim())
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {(createConversationMutation.isPending || sendMessageMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          {isCreatingConversation && (
            <p className="text-xs text-gray-500 mt-2">
              Fill in the subject and category above, then type your message to start the conversation.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}