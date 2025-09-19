import { useUser as auth0UseUser } from "@auth0/nextjs-auth0";

const isSandbox = process.env.SANDBOX === "true";

// Mock Data
const mockUser = {
    sub: 'default-user',
    email: 'local_admin@'
};


const mockUseUser = async () => {
  return mockUser;
};

export const useUser = isSandbox ? mockUseUser : auth0UseUser;
