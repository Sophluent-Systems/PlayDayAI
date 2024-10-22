import React, { useState } from 'react';
import { Tooltip } from '@mui/material';
import { IconButton } from '@mui/material';

export function CopyToClipboardIconButton({ textToCopy, icon }) {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(textToCopy);
            setIsCopied(true);

            // Reset the button's state after a short period
            setTimeout(() => setIsCopied(false), 3000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <Tooltip title={isCopied ? "Copied!" : "Copy to clipboard"}>
            <IconButton onClick={handleCopy} variant="outlined" sx={{margin:1}}>
                {icon}
            </IconButton>
        </Tooltip>
    );
}
