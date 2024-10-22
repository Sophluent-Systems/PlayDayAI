import { UserProvider as OriginalUserProvider } from '@auth0/nextjs-auth0/client';
import { useUser as OriginalUseUser } from "@auth0/nextjs-auth0/client";
import React from 'react';

const isSandbox = process.env.SANDBOX == 'true';

// Mock Data
const mockUser = {
    "sub": "default-user",
    "email": "local_admin@"
};

function mockUserProvider(props) {
    const { children } = props;
    return (
        <React.Fragment>{children}</React.Fragment>
    );
}

export const useUser = isSandbox ? () => mockUser : OriginalUseUser;

export const UserProvider = isSandbox ? (mockUserProvider) : OriginalUserProvider;

