import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { hotelChatService, HotelChatMessage } from '../services/hotelChatService';

interface AIChatWidgetProps {
  hotelId: string;
  userId: string;
  onEscalate?: () => void;
}

const QUICK_ACTIONS = [
  { label: 'Room Service', icon: '🍽️', type: 'room_service' as const },
  { label: 'Concierge', icon: '🛎️', type: 'concierge' as const },
  { label: 'Checkout', icon: '🏨', type: 'checkout' as const },
];

const INITIAL_MESSAGES: Partial<HotelChatMessage>[] = [
  {
    id: '0',
    content: 'Hello! I\'m your AI hotel assistant. How can I help you today?',
    sender: 'ai',
    timestamp: new Date(),
  },
];

export function AIChatWidget({ hotelId, userId, onEscalate }: AIChatWidgetProps) {
  const [messages, setMessages] = useState<Partial<HotelChatMessage>[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const typingOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(typingOpacity, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      typingOpacity.setValue(0);
    }
  }, [isTyping, typingOpacity]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const addMessage = (content: string, sender: 'user' | 'ai' | 'agent') => {
    const newMessage: Partial<HotelChatMessage> = {
      id: Date.now().toString(),
      content,
      sender,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    scrollToBottom();
  };

  const handleQuickAction = async (type: 'room_service' | 'concierge' | 'checkout') => {
    const actionMessages = {
      room_service: 'I\'d like to order room service, please.',
      concierge: 'I need assistance from the concierge.',
      checkout: 'I need help with checkout.',
    };

    addMessage(actionMessages[type], 'user');
    setIsTyping(true);
    scrollToBottom();

    try {
      setIsLoading(true);
      const response = await hotelChatService.sendMessage(hotelId, userId, actionMessages[type], type);
      setIsTyping(false);
      addMessage(response.content, response.sender);
    } catch (error) {
      setIsTyping(false);
      // Fallback responses based on type
      const fallbackResponses = {
        room_service: 'Room service is available 24/7. What would you like to order? Our menu includes breakfast, lunch, dinner, and late-night snacks.',
        concierge: 'Our concierge team is here to help with restaurant reservations, transportation, local recommendations, and any special requests.',
        checkout: 'Standard checkout is at 11:00 AM. Late checkout may be available for an additional fee. Would you like help with your bill or luggage storage?',
      };
      addMessage(fallbackResponses[type], 'ai');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    setInputText('');
    addMessage(userMessage, 'user');
    setIsTyping(true);
    scrollToBottom();

    try {
      setIsLoading(true);
      const response = await hotelChatService.sendMessage(hotelId, userId, userMessage, 'general');
      setIsTyping(false);
      addMessage(response.content, response.sender);
    } catch (error) {
      setIsTyping(false);
      addMessage('I\'m having trouble connecting to the server. Please try again or contact our support team directly.', 'ai');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEscalate = () => {
    addMessage('Connecting you to a human agent...', 'ai');
    onEscalate?.();
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Chat Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AI</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Hotel Assistant</Text>
            <Text style={styles.headerSubtitle}>Powered by AI</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.escalateButton} onPress={handleEscalate}>
          <Text style={styles.escalateButtonText}>Agent</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.type}
            style={styles.quickActionButton}
            onPress={() => handleQuickAction(action.type)}
          >
            <Text style={styles.quickActionIcon}>{action.icon}</Text>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.sender === 'user' ? styles.userBubble : styles.aiBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.sender === 'user' ? styles.userText : styles.aiText,
              ]}
            >
              {message.content}
            </Text>
            {message.timestamp && (
              <Text
                style={[
                  styles.messageTime,
                  message.sender === 'user' ? styles.userTime : styles.aiTime,
                ]}
              >
                {formatTime(message.timestamp)}
              </Text>
            )}
          </View>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <View style={[styles.messageBubble, styles.aiBubble]}>
            <View style={styles.typingIndicator}>
              <View style={[styles.typingDot, { opacity: typingOpacity }]} />
              <View style={[styles.typingDot, { opacity: typingOpacity }]} />
              <View style={[styles.typingDot, { opacity: typingOpacity }]} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  escalateButton: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  escalateButtonText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  quickActionIcon: {
    fontSize: 14,
  },
  quickActionLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#1e293b',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  aiTime: {
    color: '#94a3b8',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1e293b',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
