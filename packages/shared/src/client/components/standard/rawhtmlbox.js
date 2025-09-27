import React from 'react';
import {
    Box
 } from '@mui/material';

export function RawHTMLBox(params) {
    return (
        <Box
            {...params}
            dangerouslySetInnerHTML={{ __html: params.html }}
        />
    );
}
