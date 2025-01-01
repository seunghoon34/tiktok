export  const formatDate = (dateString) => {
    if (!dateString) return '';
  
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.error('Invalid date string received:', dateString);
        return '';
      }
  
      // Get user's timezone offset in minutes
      const userTimezoneOffset = date.getTimezoneOffset();
      // Create a new date adjusted for the user's timezone
      const localDate = new Date(date.getTime() - (userTimezoneOffset * 60000));
      
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
  
      const isToday = localDate.toDateString() === now.toDateString();
      const isYesterday = localDate.toDateString() === yesterday.toDateString();
      const isThisWeek = localDate >= startOfWeek;
      const isThisYear = localDate.getFullYear() === now.getFullYear();
  
      if (isToday) {
        return localDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true
        });
      } else if (isYesterday) {
        return 'Yesterday';
      } else if (isThisWeek) {
        return localDate.toLocaleDateString('en-US', {
          weekday: 'long'
        });
      } else if (isThisYear) {
        // Changed format for this year to day/month
        const day = localDate.getDate();
        const month = localDate.getMonth() + 1; // getMonth() returns 0-11
        return `${day}/${month}`;
      } else {
        // Different year: show day/month/year
        const day = localDate.getDate();
        const month = localDate.getMonth() + 1;
        const year = localDate.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (error) {
      console.error('Error formatting date:', error, 'for date string:', dateString);
      return '';
    }
  };