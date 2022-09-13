import { useState, useEffect } from "react";

const getStorageValue = <T>(key: string, defaultValue: T) => {
  const saved = localStorage.getItem(key);
  return saved === null
    ? defaultValue
    : JSON.parse(saved) as T
}

export const useLocalStorage = <T>(key: string, defaultValue: T) => {
  const [currentKey, changeKey] = useState(key)
  const [value, setValue] = useState(() => getStorageValue(key, defaultValue));

  useEffect(() => {
    setValue(getStorageValue(currentKey, defaultValue))    
  }, [currentKey])
  
  useEffect(() => {
    localStorage.setItem(currentKey, JSON.stringify(value));
  }, [currentKey, value]);

  return [value, setValue, changeKey] as const;
};