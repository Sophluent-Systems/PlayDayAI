import React, { useState } from 'react';
import { Box, Button, Popover, Typography } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'; // Import MUI's dropdown icon
import { MenuItemList } from './menuitemlist';
import { useAtom } from 'jotai';
import { vhState } from '@src/client/states';

export function MenuItemDropdown(props) {
    const { menuItems, onMenuItemSelected, selectedIndex, autoSelect, title } = props;
    const [anchorEl, setAnchorEl] = useState(null);
    const [vh, setVh] = useAtom(vhState);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        console.log("MenuItemDropdown: handleClose")
        setAnchorEl(null);
    };

    const handleMenuItemSelected = (index) => {
        console.log("MenuItemDropdown: handleMenuItemSelected")
        onMenuItemSelected(index);
        handleClose(); // Close dropdown after selection
    };

    const open = Boolean(anchorEl);
    const id = open ? 'simple-popover' : undefined;

    return (
        <Box>
            <Button 
                aria-describedby={id} 
                title={title ? title : "Select an item"}
                variant='outlined' 
                onClick={handleClick} 
                endIcon={<ArrowDropDownIcon />}
            >
                    {menuItems[selectedIndex] || 'Select an item'}
            </Button>
            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                anchorPosition={{
                    top: 0,
                    left: 0,
                }}
            >
                <Box sx={{maxHeight: `${vh-40}px`, overflow: 'auto', alignContent: 'flex-start' }}>
                    <MenuItemList
                        menuItems={menuItems}
                        onMenuItemSelected={handleMenuItemSelected}
                        selectedIndex={selectedIndex}
                        autoSelect={autoSelect}
                    />
                </Box>
            </Popover>
        </Box>
    );
}
