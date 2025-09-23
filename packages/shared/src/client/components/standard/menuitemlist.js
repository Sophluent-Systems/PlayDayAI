import React, { useState, useEffect } from 'react';
import { List, ListItem, ListItemText } from '@mui/material';

export function MenuItemList(props) {
  const { menuItems = [], onMenuItemSelected = () => {}, selectedIndex, autoSelect } = props;
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);

  const handleMenuItemSelected = (index) => {
    if (autoSelect) {
      setSelectedMenuItem(index);
    }
    onMenuItemSelected(index);
  };

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex !== undefined) {
      setSelectedMenuItem(selectedIndex);
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (autoSelect && menuItems.length > 0 && selectedMenuItem === null) {
      setSelectedMenuItem(0);
      onMenuItemSelected(0);
    }
  }, [autoSelect, menuItems, onMenuItemSelected, selectedMenuItem]);

  const renderMenuItem = (item, index) => {
    const isSelected = index === selectedMenuItem;
    const highlightSx = isSelected ? { backgroundColor: 'rgba(0, 0, 0, 0.1)' } : null;

    if (React.isValidElement(item)) {
      const existingOnClick = item.props.onClick;
      const mergedOnClick = (event) => {
        if (existingOnClick) {
          existingOnClick(event);
        }
        if (!event.defaultPrevented) {
          handleMenuItemSelected(index);
        }
      };

      let mergedSx = item.props.sx;
      if (highlightSx) {
        if (Array.isArray(mergedSx)) {
          mergedSx = [...mergedSx, highlightSx];
        } else if (typeof mergedSx === 'function') {
          mergedSx = [mergedSx, highlightSx];
        } else if (mergedSx) {
          mergedSx = { ...mergedSx, ...highlightSx };
        } else {
          mergedSx = highlightSx;
        }
      }

      return React.cloneElement(item, {
        key: item.key ?? index,
        onClick: mergedOnClick,
        button: item.props.button ?? true,
        selected: item.props.selected ?? isSelected,
        sx: mergedSx,
      });
    }

    let textContent = null;

    if (item && typeof item === 'object' && !Array.isArray(item)) {
      textContent = <ListItemText {...item} />;
    } else if (item !== null && item !== undefined) {
      textContent = <ListItemText primary={item} />;
    }

    return (
      <ListItem
        button
        key={index}
        onClick={() => handleMenuItemSelected(index)}
        selected={isSelected}
        sx={highlightSx || undefined}
      >
        {textContent}
      </ListItem>
    );
  };

  return (
    <List>
      {menuItems.map((item, index) => renderMenuItem(item, index))}
    </List>
  );
}
