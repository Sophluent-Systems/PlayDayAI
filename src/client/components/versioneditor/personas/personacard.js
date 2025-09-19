import React from 'react';
import { 
    Card, 
    CardContent, 
    Typography, 
    Tooltip, 
    Grid
} from '@mui/material';
import { PersonaIcons } from './icons';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { VisibilityOff } from '@mui/icons-material';

export const PersonaCard = ({ persona }) => {

  if (nullUndefinedOrEmpty(persona)) {
    return null;
  }

  const IconComponent = PersonaIcons[persona.theme.icon.iconID];

  return (
    <Card sx={{
      backgroundColor: persona.theme.colors.messageBackgroundColor,
      color: persona.theme.colors.messageTextColor,
      fontFamily: persona.theme.fonts.fontFamily,
      width: '100%', // Use 100% to make it responsive
      height: '40px',
      p: 0,
      m: 0,
      display: 'flex',
      borderColor: '#00000099',
      borderWidth: '1px',
      alignItems: 'center', // Align items in the center vertically
    }}>
      <Grid container alignItems="center" wrap="nowrap" sx={{ 
        width: '100%', 
        height: '100%', 
        m: 0,
      }}>
        {/* Icon Grid */}
        <Grid xs={1} sx={{ display: 'flex', alignItems: 'center', pl: 1 }}>
          <IconComponent sx={{ color: persona.theme.icon.color }} />
        </Grid>

        {/* Display Name Grid */}
        <Grid xs={2} sx={{ ml: 1 }}>
          <Typography variant="body2" sx={{ fontSize: '0.75rem', textAlign: 'left', color: persona.theme.colors.messageTextColor }}>
            {persona.displayName}
          </Typography>
        </Grid>

        {/* Identity Grid */}
        <Grid xs={8} sx={{ ml: 2 }}>
          <Typography variant="body2" sx={{ fontSize: '0.75rem', textAlign: 'left', color: persona.theme.colors.messageTextColor }}>
            {persona.identity}
          </Typography>
        </Grid>
        
        {/* Hidden from end users Grid */}
        <Grid xs={1} sx={{ ml: 2 }}>
            {persona.hideFromEndUsers &&
                <Tooltip title="Hidden from end users" placement="top">           
                    <VisibilityOff />
                </Tooltip>
            }
        </Grid>
      </Grid>
    </Card>
  );
};

