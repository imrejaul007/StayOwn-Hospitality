import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Define request handlers
const handlers = [
  // Mock any API calls if needed
  http.get('/api/*', () => {
    return HttpResponse.json({ message: 'Mock API response' });
  }),
];

// Setup server with handlers
export const server = setupServer(...handlers);