import React from 'react';
import { Hotel, Mail, MapPin } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Hotel className="h-8 w-8 text-blue-400" />
              <span className="text-xl font-bold">REZ Hotels</span>
            </div>
            <p className="text-gray-300 mb-4 max-w-md">
              REZ Hotels is the hotel booking platform of the REZ ecosystem — connecting guests, hotels, and loyalty coins in one unified experience. Real-time inventory powered by live PMS.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><a href="/" className="text-gray-300 hover:text-white transition-colors">Home</a></li>
              <li><a href="/rooms" className="text-gray-300 hover:text-white transition-colors">Browse Hotels</a></li>
              <li><a href="/about" className="text-gray-300 hover:text-white transition-colors">About the Platform</a></li>
              <li><a href="/for-hotels" className="text-gray-300 hover:text-white transition-colors">For Hotels</a></li>
              <li><a href="/reviews" className="text-gray-300 hover:text-white transition-colors">Reviews</a></li>
              <li><a href="/contact" className="text-gray-300 hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Get in Touch</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-blue-400" />
                <a href="/contact" className="text-gray-300 hover:text-white transition-colors">Contact Support</a>
              </div>
              <div className="flex items-center space-x-2">
                <Hotel className="h-4 w-4 text-blue-400" />
                <a href="/for-hotels" className="text-gray-300 hover:text-white transition-colors">List your hotel</a>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-blue-400" />
                <span className="text-gray-300">Part of the REZ Ecosystem</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-gray-400">
            © {new Date().getFullYear()} REZ Hotels · Part of the REZ Platform · All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}