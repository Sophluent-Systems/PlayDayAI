
//
// Returns true if the code is running in the NEXTJS frontend.
//
export const isFrontend = () => {
    return process.env.NEXT_RUNTIME === 'nodejs';
}