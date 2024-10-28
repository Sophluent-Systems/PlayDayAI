import React, { useEffect, useState } from 'react';
import { ChatCard } from '@src/client/components/chatcard';
import { 
    Box 
} from '@mui/material';

const shortFlavors = {
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
}

const extendedFlavors = {
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    image: '/logo.png',
    audio: '/hello.mp3',
}

export function PersonaPreview(props) {
    const { theme, persona, extended } = props;

    return (
    <Box sx={{
        display: 'flex',
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
    }}>
        {extended ?
            Object.keys(extendedFlavors).map((key) =>
                {
                   const contentItem = {}
                   contentItem[key] = extendedFlavors[key];
                   return <ChatCard
                            key={key}
                            theme={theme}
                            message={{
                                content: contentItem,
                                persona,
                                nodeAttributes:{
                                    mediaTypes:[key],
                                }
                            }}
                            onRequestAudioControl={() => {}}
                        />
                }
            )
        :
            <ChatCard
                theme={theme}
                message={{
                    content: shortFlavors,
                    persona,
                    nodeAttributes:{
                        mediaTypes:["text"],
                    }
                }}
                onRequestAudioControl={() => {}}
            />
        }
    </Box>
    );
}