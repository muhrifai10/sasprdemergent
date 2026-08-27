import { createContext, useContext, useState } from "react";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("prdai_lang") || "id");
  const toggle = () => {
    const next = lang === "id" ? "en" : "id";
    setLang(next);
    localStorage.setItem("prdai_lang", next);
  };
  return (
    <LanguageContext.Provider value={{ lang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
