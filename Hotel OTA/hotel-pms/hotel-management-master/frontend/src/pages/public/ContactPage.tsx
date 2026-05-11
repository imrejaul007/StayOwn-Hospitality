import React, { useEffect, useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send, Facebook, Twitter, Instagram, Youtube, MapIcon, Sparkles, Award, Users, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import contactService, { ContactForm } from '../../services/contactService';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function ContactPage() {
  const [formData, setFormData] = useState<ContactForm>({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    document.title = 'Contact Us - The Pentouz';
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);
    
    // Validate form data
    const validation = contactService.validateContactForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      setLoading(false);
      return;
    }

    try {
      await contactService.submitContactForm(formData);
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setErrors([err.response?.data?.message || 'An error occurred while sending your message. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Hero Section */}
      <section className="relative py-24 bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 right-10 w-64 h-64 bg-yellow-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-10 w-80 h-80 bg-blue-500 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full mb-6">
              <Phone className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
              Get in <span className="text-yellow-400">Touch</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              We're here to help you plan the perfect stay at The Pentouz. Reach out to us for reservations, 
              inquiries, or any assistance you need.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 text-center">
                <Award className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
                <h3 className="font-semibold text-white mb-1">Premium Service</h3>
                <p className="text-gray-300 text-sm">24/7 customer support</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 text-center">
                <Users className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
                <h3 className="font-semibold text-white mb-1">Expert Team</h3>
                <p className="text-gray-300 text-sm">Hospitality professionals</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 text-center">
                <Shield className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
                <h3 className="font-semibold text-white mb-1">Secure Booking</h3>
                <p className="text-gray-300 text-sm">Safe & trusted platform</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Contact Information */}
            <div className="lg:col-span-1 space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Contact Information</h2>
                <p className="text-gray-600 text-lg leading-relaxed">
                  Ready to experience luxury hospitality? Get in touch with us today.
                </p>
              </div>

              {/* Corporate Office */}
              <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center mr-4">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Corporate Office</h3>
                </div>
                <div className="space-y-3 text-gray-700">
                  <p className="text-base leading-relaxed">
                    46, 6th Cross, Lavelle Road<br />
                    Bangalore - 560001, India
                  </p>
                </div>
              </Card>

              {/* Phone Numbers */}
              <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-green-700 rounded-full flex items-center justify-center mr-4">
                    <Phone className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Phone</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <a href="tel:+918884449930" className="text-gray-700 hover:text-green-600 transition-colors font-medium">
                      +91 8884449930
                    </a>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <a href="tel:+918970298300" className="text-gray-700 hover:text-green-600 transition-colors font-medium">
                      +91 8970298300
                    </a>
                  </div>
                </div>
              </Card>

              {/* Email */}
              <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mr-4">
                    <Mail className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Email</h3>
                </div>
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  <a href="mailto:sales@pentouz.com" className="text-gray-700 hover:text-purple-600 transition-colors font-medium">
                    sales@pentouz.com
                  </a>
                </div>
              </Card>

              {/* Business Hours */}
              <Card className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full flex items-center justify-center mr-4">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Business Hours</h3>
                </div>
                <div className="space-y-2 text-gray-700">
                  <div className="flex justify-between">
                    <span className="font-medium">Monday - Friday</span>
                    <span>9:00 AM - 8:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Saturday - Sunday</span>
                    <span>10:00 AM - 6:00 PM</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-yellow-200">
                    <p className="text-sm text-gray-600">
                      <strong>24/7 Emergency Support Available</strong>
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card className="p-8">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Send us a Message</h2>
                  <p className="text-gray-600 text-lg">
                    Have a question or special request? We'll get back to you within 24 hours.
                  </p>
                </div>

                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Send className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Message Sent Successfully!</h3>
                    <p className="text-gray-600 mb-6">
                      Thank you for contacting The Pentouz. We'll get back to you soon.
                    </p>
                    <Button onClick={() => setSubmitted(false)} variant="secondary">
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Error Messages */}
                    {errors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center mr-2">
                            <span className="text-white text-xs font-bold">!</span>
                          </div>
                          <h4 className="text-red-800 font-medium">Please fix the following errors:</h4>
                        </div>
                        <ul className="list-disc list-inside space-y-1">
                          {errors.map((error, index) => (
                            <li key={`errors-${index}-${error}`} className="text-red-700 text-sm">{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name *
                        </label>
                        <Input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Rajesh Kumar"
                          required
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address *
                        </label>
                        <Input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="rajesh@example.com"
                          required
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number
                        </label>
                        <Input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="+91 98765 43210"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Subject *
                        </label>
                        <Input
                          type="text"
                          name="subject"
                          value={formData.subject}
                          onChange={handleInputChange}
                          placeholder="Room Reservation Inquiry"
                          required
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Message *
                      </label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleInputChange}
                        rows={6}
                        placeholder="I would like to inquire about room availability for my upcoming trip to Bangalore..."
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                      />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>Privacy Notice:</strong> Your information is secure and will only be used to respond to your inquiry. 
                        We respect your privacy and follow strict data protection guidelines.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 transform hover:scale-105 transition-all duration-300 shadow-xl"
                      >
                        {loading ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Sending...
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <Send className="h-5 w-5 mr-2" />
                            Send Message
                          </div>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setFormData({ name: '', email: '', phone: '', subject: '', message: '' })}
                        className="flex-1 sm:flex-initial"
                      >
                        Clear Form
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Social Media & Map Section */}
      <section className="py-24 bg-gradient-to-br from-gray-100 to-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Social Media */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Stay Connected</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                <a href="#" className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                  <Facebook className="h-12 w-12 text-blue-600 group-hover:text-blue-700 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 text-center group-hover:text-blue-600">Facebook</h3>
                  <p className="text-sm text-gray-500 text-center mt-1">Follow us</p>
                </a>
                <a href="#" className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                  <Twitter className="h-12 w-12 text-sky-500 group-hover:text-sky-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 text-center group-hover:text-sky-500">Twitter</h3>
                  <p className="text-sm text-gray-500 text-center mt-1">Latest updates</p>
                </a>
                <a href="#" className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                  <Instagram className="h-12 w-12 text-pink-500 group-hover:text-pink-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 text-center group-hover:text-pink-500">Instagram</h3>
                  <p className="text-sm text-gray-500 text-center mt-1">Photos & stories</p>
                </a>
                <a href="#" className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                  <Youtube className="h-12 w-12 text-red-500 group-hover:text-red-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 text-center group-hover:text-red-500">YouTube</h3>
                  <p className="text-sm text-gray-500 text-center mt-1">Video tours</p>
                </a>
                <a href="#" className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                  <MapIcon className="h-12 w-12 text-red-400 group-hover:text-red-500 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 text-center group-hover:text-red-400">Pinterest</h3>
                  <p className="text-sm text-gray-500 text-center mt-1">Design inspiration</p>
                </a>
                <div className="group bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                  <Sparkles className="h-12 w-12 text-white mx-auto mb-4" />
                  <h3 className="font-semibold text-white text-center">Newsletter</h3>
                  <p className="text-sm text-yellow-100 text-center mt-1">Subscribe for offers</p>
                </div>
              </div>
            </div>

            {/* Location Map Placeholder */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Find Us</h2>
              <Card className="p-6 h-96 bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200">
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MapPin className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Lavelle Road, Bangalore</h3>
                    <p className="text-gray-600 mb-4">
                      Located in the heart of Bangalore's business district
                    </p>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      View on Google Maps
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full mb-4">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2">THE PENTOUZ</h3>
            <p className="text-gray-400">Hotels & Resorts</p>
          </div>
          <div className="border-t border-gray-700 pt-6">
            <p className="text-gray-400">
              © THE PENTOUZ HOTELS & RESORTS ALL RIGHTS RESERVED, {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default withErrorBoundary(ContactPage);
