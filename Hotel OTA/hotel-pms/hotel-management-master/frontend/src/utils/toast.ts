// Simple toast notification system
const activeTimers = new Set<ReturnType<typeof setTimeout>>();

export const toast = {
  success: (message: string) => {
    showToast(message, 'success');
  },
  error: (message: string) => {
    showToast(message, 'error');
  },
  info: (message: string) => {
    showToast(message, 'info');
  },
  cleanup: () => {
    activeTimers.forEach(timer => clearTimeout(timer));
    activeTimers.clear();
  },
};

function trackTimer(timer: ReturnType<typeof setTimeout>): ReturnType<typeof setTimeout> {
  activeTimers.add(timer);
  return timer;
}

function showToast(message: string, type: 'success' | 'error' | 'info') {
  // Create toast element
  const toastEl = document.createElement('div');
  toastEl.className = `
    fixed top-4 right-4 z-50 max-w-md p-4 rounded-md shadow-lg transform translate-x-0 transition-all duration-300
    ${type === 'success' ? 'bg-green-500 text-white' : ''}
    ${type === 'error' ? 'bg-red-500 text-white' : ''}
    ${type === 'info' ? 'bg-blue-500 text-white' : ''}
  `.trim();

  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center';
  const span = document.createElement('span');
  span.className = 'flex-1';
  span.textContent = message;
  const btn = document.createElement('button');
  btn.className = 'ml-2 text-white hover:text-gray-200';
  btn.textContent = '\u00d7';
  btn.addEventListener('click', () => toastEl.remove());
  wrapper.append(span, btn);
  toastEl.appendChild(wrapper);

  // Add to document
  document.body.appendChild(toastEl);

  // Animate in
  const animateTimer = trackTimer(setTimeout(() => {
    activeTimers.delete(animateTimer);
    toastEl.style.transform = 'translateX(0)';
  }, 10));

  // Auto remove after 5 seconds
  const removeTimer = trackTimer(setTimeout(() => {
    activeTimers.delete(removeTimer);
    toastEl.style.transform = 'translateX(full)';
    const cleanupTimer = trackTimer(setTimeout(() => {
      activeTimers.delete(cleanupTimer);
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, 300));
  }, 5000));
}

export default toast;
