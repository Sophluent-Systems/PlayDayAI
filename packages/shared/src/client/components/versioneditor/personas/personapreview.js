import React from 'react';
import { ChatCard } from '@src/client/components/chatcard';

const shortFlavors = {
  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
};

const extendedFlavors = {
  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  image: '/logo.png',
  audio: '/hello.mp3',
};

export function PersonaPreview({ theme, persona, extended }) {
  const flavors = extended ? extendedFlavors : shortFlavors;
  const flavorKeys = Object.keys(flavors);

  return (
    <div className='flex w-full flex-col items-center gap-3'>
      {flavorKeys.map((key) => {
        const contentItem = { [key]: flavors[key] };
        return (
          <ChatCard
            key={key}
            theme={theme}
            message={{
              content: contentItem,
              persona,
              nodeAttributes: { mediaTypes: [key] },
            }}
            onRequestAudioControl={() => {}}
          />
        );
      })}
    </div>
  );
}
