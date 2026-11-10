const isBrowser = typeof window !== 'undefined';
const host = isBrowser && window.location.hostname ? window.location.hostname : 'localhost';

export const environment = {
  apiUrl: `http://${host}:3000/api`,
};
