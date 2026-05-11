import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RoleBasedRedirect() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      switch (user.role) {
        case 'admin':
          navigate('/admin', { replace: true });
          break;
        case 'staff':
          navigate('/staff', { replace: true });
          break;
        case 'guest':
          navigate('/app', { replace: true });
          break;
        default:
          // Stay on homepage for unauthenticated users
          break;
      }
    }
  }, [user, isLoading, navigate]);

  return null; // This component doesn't render anything
}