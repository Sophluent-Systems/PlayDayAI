

export const isBackend = () => {
    return process.env.NEXT_RUNTIME === 'edge' || process.env.NEXT_RUNTIME === 'nodejs';
}