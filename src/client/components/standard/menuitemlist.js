import React, { useState, useEffect } from 'react';
import { Box, List, ListItem, ListItemText } from '@mui/material';

export function MenuItemList(props) {
  const { menuItems, onMenuItemSelected, selectedIndex, autoSelect } = props;
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);

  const handleMenuItemSelected = (index) => {
    if (autoSelect) {
        setSelectedMenuItem(index);
    }
    onMenuItemSelected(index);
  };

  useEffect(() => {
    if (selectedIndex !== null) {
        setSelectedMenuItem(selectedIndex);
    }
   }, [selectedIndex]);

  // useEffect - If menuItems has at least one entry and selectedMenuItem is null, set selectedMenuItem to 0
  useEffect(() => {
    if (autoSelect && menuItems.length > 0 && selectedMenuItem === null) {
        handleMenuItemSelected(0);
    }
  }, [menuItems]);
  

  return (
        <List 
          sx={{}}
        >
            {menuItems && menuItems.map((item, index) => (
              <ListItem 
            button 
            key={index} 
            onClick={() => handleMenuItemSelected(index)}
            sx={{
                backgroundColor: index === selectedMenuItem ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
            }}>
                <ListItemText primary={item} />
              </ListItem>
            ))}
          </List>
  );
};
