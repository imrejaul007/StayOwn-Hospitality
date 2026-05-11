import { api } from './api';

export interface ContactForm {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  hotelId?: string;
}

export interface ContactSubmissionResponse {
  submissionId: string;
  submittedAt: string;
  expectedResponse: string;
}

export interface ContactInfo {
  corporateOffice: {
    address: {
      street: string;
      city: string;
      state: string;
      country: string;
      zipCode: string;
    };
    phone: string[];
    email: string;
  };
  businessHours: {
    weekdays: string;
    weekends: string;
    emergency: string;
  };
  socialMedia: {
    facebook: string;
    twitter: string;
    instagram: string;
    youtube: string;
    pinterest: string;
  };
  responseTime: string;
  languages: string[];
  copyright: string;
}

export interface HotelContact {
  id: string;
  name: string;
  description: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  contact: {
    phone: string;
    email: string;
    website?: string;
  };
  images: string | null;
  amenities: string[];
}

class ContactService {
  // Submit contact form
  async submitContactForm(formData: ContactForm): Promise<ContactSubmissionResponse> {
    try {
      const response = await api.post('/contact', formData);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get contact information
  async getContactInfo(): Promise<ContactInfo> {
    try {
      const response = await api.get('/contact/info');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get hotels with contact information
  async getHotelsContact(): Promise<{
    hotels: HotelContact[];
    total: number;
  }> {
    try {
      const response = await api.get('/contact/hotels');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Validate contact form data
  validateContactForm(formData: ContactForm): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Name validation
    if (!formData.name || formData.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }
    if (formData.name && formData.name.length > 100) {
      errors.push('Name cannot exceed 100 characters');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      errors.push('Please provide a valid email address');
    }

    // Phone validation (optional)
    if (formData.phone) {
      const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,20}$/;
      if (!phoneRegex.test(formData.phone)) {
        errors.push('Please provide a valid phone number');
      }
    }

    // Subject validation
    if (!formData.subject || formData.subject.trim().length < 5) {
      errors.push('Subject must be at least 5 characters long');
    }
    if (formData.subject && formData.subject.length > 200) {
      errors.push('Subject cannot exceed 200 characters');
    }

    // Message validation
    if (!formData.message || formData.message.trim().length < 10) {
      errors.push('Message must be at least 10 characters long');
    }
    if (formData.message && formData.message.length > 2000) {
      errors.push('Message cannot exceed 2000 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Format phone number for display
  formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Format Indian phone numbers
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    
    return phone; // Return original if no pattern matches
  }

  // Get common inquiry subjects for suggestions
  getCommonSubjects(): string[] {
    return [
      'Room Reservation Inquiry',
      'Event Booking Request', 
      'Corporate Accommodation',
      'Wedding & Celebration Planning',
      'Airport Transfer Service',
      'Special Dietary Requirements',
      'Accessibility Services',
      'Extended Stay Rates',
      'Group Booking Discount',
      'Loyalty Program Information',
      'Compliment or Feedback',
      'General Information',
      'Other'
    ];
  }

  // Get default message templates
  getMessageTemplates(): { [key: string]: string } {
    return {
      'Room Reservation Inquiry': 'I would like to inquire about room availability for my upcoming visit to Bangalore. Please let me know about rates and availability for the following dates:',
      'Event Booking Request': 'I am interested in booking your facilities for an event. Please provide information about your event spaces, capacity, and catering options.',
      'Corporate Accommodation': 'Our company requires accommodation for business travelers visiting Bangalore. Please share your corporate rates and long-term stay options.',
      'Wedding & Celebration Planning': 'We are planning a wedding celebration and would like to know about your banquet facilities, decoration options, and catering services.',
      'Airport Transfer Service': 'Please provide information about your airport transfer services, including rates and booking procedures.',
      'Group Booking Discount': 'I am planning to book multiple rooms for a group. Please let me know about group discounts and special rates available.',
      'General Information': 'I would like to know more about The Pentouz and your services. Please provide general information about your facilities and amenities.'
    };
  }
}

export default new ContactService();