import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

const testAvatarUpload = async () => {
  const API_URL = 'http://localhost:4000/api/v1';

  // First login as admin
  console.log('1. Logging in as admin...');
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@hotel.com',
      password: 'admin123'
    })
  });

  const loginData = await loginResponse.json();
  if (!loginData.token) {
    console.error('Failed to login');
    return;
  }

  const token = loginData.token;
  console.log('✅ Login successful');

  // Check if avatar endpoint is accessible
  console.log('\n2. Testing avatar upload endpoint...');

  // Create a simple test image (a small PNG buffer)
  const createTestImage = () => {
    // Create a minimal PNG file buffer (1x1 transparent pixel)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, // IHDR chunk size
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, // Width: 1
      0x00, 0x00, 0x00, 0x01, // Height: 1
      0x08, 0x06, 0x00, 0x00, 0x00, // Bit depth, Color type, Compression, Filter, Interlace
      0x1F, 0x15, 0xC4, 0x89, // CRC
      0x00, 0x00, 0x00, 0x0A, // IDAT chunk size
      0x49, 0x44, 0x41, 0x54, // IDAT
      0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // Compressed data
      0xE5, 0x27, 0xDE, 0xFC, // CRC
      0x00, 0x00, 0x00, 0x00, // IEND chunk size
      0x49, 0x45, 0x4E, 0x44, // IEND
      0xAE, 0x42, 0x60, 0x82  // CRC
    ]);
    return pngBuffer;
  };

  try {
    const formData = new FormData();
    const testImageBuffer = createTestImage();
    formData.append('avatar', testImageBuffer, {
      filename: 'test-avatar.png',
      contentType: 'image/png'
    });

    const uploadResponse = await fetch(`${API_URL}/upload/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const uploadData = await uploadResponse.json();
    console.log('Upload response status:', uploadResponse.status);
    console.log('Upload response:', uploadData);

    if (uploadResponse.ok) {
      console.log('✅ Avatar upload successful');
      console.log('Avatar URL:', uploadData.data?.avatarUrl);

      // Test getting current user to verify avatar is saved
      console.log('\n3. Getting current user to verify avatar...');
      const userResponse = await fetch(`${API_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const userData = await userResponse.json();
      console.log('Current user avatar:', userData.user?.avatar);

      if (userData.user?.avatar) {
        console.log('✅ Avatar persisted successfully');
      } else {
        console.log('❌ Avatar not found in user data');
      }
    } else {
      console.log('❌ Avatar upload failed');
    }
  } catch (error) {
    console.error('❌ Avatar upload error:', error);
  }
};

// Run the test
testAvatarUpload().catch(console.error);