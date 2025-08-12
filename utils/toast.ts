import Toast from 'react-native-toast-message';

export const showToast = {
  success: (title: string, message?: string) => {
    Toast.show({
      type: 'success',
      text1: title,
      text2: message,
    });
  },
  
  error: (title: string, message?: string) => {
    Toast.show({
      type: 'error',
      text1: title,
      text2: message,
    });
  },
  
  info: (title: string, message?: string) => {
    Toast.show({
      type: 'info',
      text1: title,
      text2: message,
    });
  },
  
  // Quick shortcuts for common messages
  reportSubmitted: () => {
    Toast.show({
      type: 'success',
      text1: 'Report Submitted',
      text2: 'Thank you for helping keep our community safe',
    });
  },
  
  userBlocked: (username: string) => {
    Toast.show({
      type: 'success',
      text1: 'User Blocked',
      text2: `You have blocked ${username}`,
    });
  },
  
  userUnblocked: (username?: string) => {
    Toast.show({
      type: 'success',
      text1: 'User Unblocked',
      text2: username ? `You can now interact with ${username} again` : 'You can now interact with this user again',
    });
  },
  
  networkError: () => {
    Toast.show({
      type: 'error',
      text1: 'Network Error',
      text2: 'Please check your connection and try again',
    });
  },
  
  genericError: () => {
    Toast.show({
      type: 'error',
      text1: 'Something went wrong',
      text2: 'Please try again later',
    });
  }
};

export default showToast;
