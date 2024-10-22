import React, { useState } from 'react';
import { 
    Menu, 
    MenuItem, 
    Typography,
} from '@mui/material';

export function ContextMenu(props) {
  const { children, menuItems } = props;
  const [visible, setVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState({ mouseX: 0, mouseY: 0 });

  
  function handleContextMenu(event) {
    event.preventDefault();
    setContextMenu({
        mouseX: event.clientX - 2,
        mouseY: event.clientY - 4,
    });
    setVisible(true);
  };

  const handleClose = () => {
    setVisible(false);
  };

  async function handleClickInternal(event, item) {
    setVisible(false);
    if (item.onClick) {
        item.onClick();
    }
  };


  return (
    <div id='containerEl' onContextMenu={(event) => handleContextMenu(event)} style={{ cursor: 'context-menu', userSelect: 'none' }}>
      {children}
      <Menu
        open={visible}
        onClose={() => handleClose()}
        anchorReference="anchorPosition"
        anchorPosition={
          visible ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
      >
        {menuItems.map((item, index) => <MenuItem key={"contextmenuitem-" + index} onClick={(event) => handleClickInternal(event, item)}>{item.label}</MenuItem>)}
      </Menu>
    </div>
  );
}
