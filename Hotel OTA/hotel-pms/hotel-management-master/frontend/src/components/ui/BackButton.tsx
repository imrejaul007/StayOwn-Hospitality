import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BackButtonProps {
  to?: string;
  label?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: 'arrow' | 'chevron';
  className?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
  to,
  label = 'Back',
  variant = 'ghost',
  size = 'sm',
  icon = 'arrow',
  className = ''
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1); // Go back in history
    }
  };

  const IconComponent = icon === 'chevron' ? ChevronLeft : ArrowLeft;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleBack}
      className={`flex items-center gap-2 ${className}`}
    >
      <IconComponent className={sizeClasses[size]} />
      {label}
    </Button>
  );
};

export default BackButton;