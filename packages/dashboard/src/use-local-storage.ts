import { useState, useEffect } from "react";

const getStorageValue = <T>(key:string, defaultValue:T) => {
  const saved = localStorage.getItem(key);
  return saved === null 
    ?  defaultValue 
    :  JSON.parse(saved) as T
}

export const useLocalStorage = <T>(key:string, defaultValue:T) => {
  const [value, setValue] = useState(() =>  getStorageValue(key, defaultValue));

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
};