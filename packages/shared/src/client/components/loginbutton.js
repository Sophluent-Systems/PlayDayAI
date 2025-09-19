import React from "react";

export const LoginButton = () => {
  const handleLogin = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
  };

  return (
    <button type="button" onClick={handleLogin}>
      Log In
    </button>
  );
};
