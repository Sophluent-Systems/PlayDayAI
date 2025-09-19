import React from 'react';
import { 
    Box,
    Paper,  
} from '@mui/material';


export function NodeContainer(props) {
    const { styling, children, onDragStart, draggable, width, height } = props;

    if (!width || !height) {
        throw new Error("NodeContainer requires width and height props");
    }

    const containerWidth = `${width}px`;
    const containerHeight = `${height}px`;

    return (
        <Paper 
            sx={{
                display: 'flex', // Make sure the Paper acts as a flex container
                flexDirection: 'row', // Arrange children in a row
                alignItems: 'center', // Center children vertically
                border: '1px solid gray',
                borderRadius: '4px',
                padding: '4px',
                width: containerWidth,
                height: containerHeight,
                position: 'relative',
                backgroundColor: styling.backgroundColor,
                color: styling.color,
                borderStyle: styling.borderStyle ? styling.borderStyle : 'solid',
            }}
            onDragStart={onDragStart}
            draggable={draggable}
        >

                {children}
        
        </Paper>
    );
}