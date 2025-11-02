
import { useState, useEffect } from 'react';

function useLocalStorage<T,>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        return JSON.parse(atob(item));
      }
      return initialValue;
    } catch (error) {
      console.error('Error reading from localStorage', error);
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, btoa(JSON.stringify(valueToStore)));
    } catch (error) {
      console.error('Error writing to localStorage', error);
    }
  };

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(atob(item)));
      }
    } catch (error) {
      // If error, it might be an old un-encoded value. Clear it.
      window.localStorage.removeItem(key);
    }
  }, [key]);

  return [storedValue, setValue];
}

export default useLocalStorage;
