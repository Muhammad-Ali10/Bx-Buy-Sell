export const SESSION_KEY = "APP_SESSION_MIN";

export const getSession = () => {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(SESSION_KEY);
  // console.log(data);
  return data ? JSON.parse(data) : null;
};

export const setSession = (session) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
};
