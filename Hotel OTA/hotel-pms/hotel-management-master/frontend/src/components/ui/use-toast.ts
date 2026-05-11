import { toast as toastUtil } from '../../utils/toast';

export const useToast = () => {
  return {
    toast: toastUtil
  };
};

export const toast = toastUtil;