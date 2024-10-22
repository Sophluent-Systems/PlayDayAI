import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Stack,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { makeStyles } from 'tss-react/mui';
import { useRecoilState } from 'recoil';
import { vhState, collapsiblePanelSettingsState } from '@src/client/states';
import { nullUndefinedOrEmpty } from '@src/common/objects';

const useStyles = makeStyles()((theme) => ({
  container: {
    width: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    alignContent: 'flex-start',
    position: 'relative',
    backgroundColor: theme.palette.background.immersive,
  },
  buttonRow: {
    position: 'absolute',
    top: theme.spacing(1),
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: 'rgba(8, 8, 8, 0.5)',
    zIndex: 10,
  },
  button: {
    margin: theme.spacing(0, 0.5),
    minWidth: '36px',
    height: '28px',
    padding: theme.spacing(0, 1),
    borderRadius: '14px', // Make buttons more pill-shaped
    fontSize: '0.75rem',
    fontWeight: 'bold',
    textTransform: 'none',
    transition: theme.transitions.create(['background-color', 'box-shadow', 'color'], {
      duration: theme.transitions.duration.short,
    }),
  },
}));

const drawerWidthCollapsed = 80;

export function CollapsiblePanelLayout(props) {
  const { panels, persistKey } = props;
  const [drawerOpen, setDrawerOpen] = useState(null);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const { classes } = useStyles();
  const [vh, setVh] = useRecoilState(vhState);
  const [collapsiblePanelSettings, setCollapsiblePanelSettings] = useRecoilState(collapsiblePanelSettingsState);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    return () => {
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  useEffect(() => {
    if (persistKey) {
      if (collapsiblePanelSettings && panels) {
        
        if (!nullUndefinedOrEmpty(collapsiblePanelSettings[persistKey])){
          if (!drawerOpen) {
            setDrawerOpen(collapsiblePanelSettings[persistKey]);
          }
        } else if (nullUndefinedOrEmpty(drawerOpen) || panels.length !== drawerOpen.length) {
          const newDrawerOpenState = panels.map(panel => panel.defaultOpen);
          setDrawerOpen(newDrawerOpenState);
          setCollapsiblePanelSettings({
            ...collapsiblePanelSettings,
            [persistKey]: newDrawerOpenState,
          });
        }
      }
    } else {
      if (nullUndefinedOrEmpty(drawerOpen) || panels.length !== drawerOpen.length) {
        setDrawerOpen(panels.map(panel => panel.defaultOpen));
      }
    }
  }, [panels, collapsiblePanelSettings]);

  function calculateDrawerWidth(panelIndex) {

    if (drawerOpen[panelIndex] && panels[panelIndex].width) {
      return panels[panelIndex].width;
    }
    if (!drawerOpen[panelIndex]) {
      return drawerWidthCollapsed;
    }

    let widthOfOpenDrawersWithPredeterminedWidth = 0;
    let numberOfOpenDrawersWithFlexibledWidth = 0;
    let totalWidthOfClosedDrawers = 0;

    for (let i = 0; i < panels.length; i++) {
      if (drawerOpen[i]) {
        if (panels[i].width) {
          widthOfOpenDrawersWithPredeterminedWidth += panels[i].width;
        } else {
          numberOfOpenDrawersWithFlexibledWidth++;
        }
      } else {
        totalWidthOfClosedDrawers += drawerWidthCollapsed;
      }
    }

    let totalWidthOfFlexibleDrawers = width - totalWidthOfClosedDrawers - widthOfOpenDrawersWithPredeterminedWidth;

    return totalWidthOfFlexibleDrawers / numberOfOpenDrawersWithFlexibledWidth;
  }
  

  function handleDrawerToggle(index) {
    console.log("handleDrawerToggle: ", index, drawerOpen[index])
    if (panels[index].lockedOpen) {
      return;
    }
    const newDrawerOpen = [...drawerOpen];
    newDrawerOpen[index] = !newDrawerOpen[index];

    // If the last panel on the right is being closed and all others are closed, reopen the immediate left panel
    if (index === panels.length - 1 && newDrawerOpen.every((open, i) => i === index || !open)) {
      const leftIndex = Math.max(0, index - 1);
      newDrawerOpen[leftIndex] = true;
    }

    // If the first panel on the left is being closed and all others are closed, reopen the immediate right panel
    if (index === 0 && newDrawerOpen.every((open, i) => i === index || !open)) {
      const rightIndex = Math.min(panels.length - 1, index + 1);
      newDrawerOpen[rightIndex] = true;
    }

    setDrawerOpen(newDrawerOpen);
    if (persistKey) {
      setCollapsiblePanelSettings({
        ...collapsiblePanelSettings,
        [persistKey]: newDrawerOpen,
      });
    }
  }

  function renderDrawer(panelIndex) {
    const isLastPanel = panelIndex === panels.length - 1;
    const drawerWidth = calculateDrawerWidth(panelIndex);
  
    return (
      <Box
        sx={{
          width: drawerWidth,
          maxHeight: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: (theme) => theme.palette.background.paper,
          paddingRight: '1px',
          borderRight: isLastPanel ? 'none' : (theme) => `1px solid ${theme.palette.divider}`,
          position: 'relative',
          boxSizing: 'border-box',
        }}
        key={panelIndex}
      >
        {drawerOpen[panelIndex] 
          ? panels[panelIndex].content
          : <Box sx={{ display: 'flex', flexDirection: 'column', height: `${vh}px` }} />
        }
  
        {!drawerOpen[panelIndex] && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              borderRight: (theme) => `1px solid ${theme.palette.divider}`,
              zIndex: 1,
              cursor: 'pointer',
            }}
            onClick={() => handleDrawerToggle(panelIndex)}
          >
            <Typography
              variant="h6"
              component="div" 
              sx={{
                transform: `rotate(${isLastPanel ? 90 : 270}deg)`,
                transformOrigin: 'center',
                whiteSpace: 'nowrap',
                color: (theme) => theme.palette.text.primary,
                textAlign: 'center',
              }}
            >
              {panels[panelIndex].label}
            </Typography>
          </Box>
        )}
    
        {!panels[panelIndex].lockedOpen && (
          <IconButton
            onClick={() => handleDrawerToggle(panelIndex)}
            sx={{
              position: 'absolute',
              [isLastPanel ? 'right' : 'left']: 10,
              bottom: '80px',
              zIndex: 2,
              backgroundColor: (theme) => theme.palette.action.active,
              color: (theme) => theme.palette.background.paper,
              '&:hover': {
                backgroundColor: (theme) => theme.palette.action.hover,
              },
            }}
          >
            {isLastPanel ? (drawerOpen[panelIndex] ? <ChevronRight /> : <ChevronLeft />) : (drawerOpen[panelIndex] ? <ChevronLeft /> : <ChevronRight />)}
          </IconButton>
        )}
      </Box>
    );
  }
  
function renderPanelButtons() {

  return (
    <Stack direction="row" className={classes.buttonRow}>
      {panels.map((panel, index) => (
        <Button
          key={index}
          className={classes.button}
          onClick={() => handleDrawerToggle(index)}
          sx={{
            backgroundColor: (theme) => drawerOpen[index] 
              ? theme.palette.primary.main
              : theme.palette.action.disabledBackground,
            color: (theme) => drawerOpen[index]
              ? theme.palette.primary.contrastText
              : theme.palette.text.disabled,
            '&:hover': {
              backgroundColor: (theme) => drawerOpen[index]
                ? theme.palette.primary.dark
                : theme.palette.action.hover,
            },
            boxShadow: (theme) => drawerOpen[index]
              ? theme.shadows[4]
              : 'none',
          }}
        >
          {panel.label}
        </Button>
      ))}
    </Stack>
  );
  }

  return (
    <Box ref={containerRef} className={classes.container} height={`${vh}px`}>
      {(drawerOpen && panels) && panels.map((_, index) => renderDrawer(index))}
      {(drawerOpen && panels) && renderPanelButtons()} 
    </Box>
  );
}