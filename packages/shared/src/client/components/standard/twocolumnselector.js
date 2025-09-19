import React, { useEffect, useState } from 'react';
import { 
    Box,
    Button,
    Typography,
    List, 
    ListItemButton, 
    ListItemText, 
    Paper,
    useTheme,
    Grid,
} from '@mui/material';

export function TwoColumnSelector({
    columnAlabel,
    columnAdata,
    columnBlabel,
    columnBdata,
    onAsynchronouslyMoveItems,
}) {
    const [selectedFromColumnA, setSelectedFromColumnA] = useState([]);
    const [selectedFromColumnB, setSelectedFromColumnB] = useState([]);

    const theme = useTheme();

    const handleSelect = (role, column) => {
        if (column === 'A') {
            setSelectedFromColumnA(prev => 
                prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
            );
        } else {
            setSelectedFromColumnB(prev => 
                prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
            );
        }
    };

    async function transferItems(toDirection) {
        let doMove = true;
        if (toDirection === "columnA") {
            if (onAsynchronouslyMoveItems) {
                doMove = await onAsynchronouslyMoveItems(selectedFromColumnB, null);
            }
            if (doMove) {
                setSelectedFromColumnB([]);
            }
        } else if (toDirection === "columnB") {
            if (onAsynchronouslyMoveItems) {
                doMove = await onAsynchronouslyMoveItems(null, selectedFromColumnA);
            }
            if (doMove) {
                setSelectedFromColumnA([]);
            }
        }
    }

    const renderColumn = (data, label, selected, column) => (
        <Grid xs={8}>
            <Paper variant="outlined" sx={{ padding: 2, height: '100%', minWidth: 200 }}>
                <Typography align="center" gutterBottom variant="subtitle1" fontWeight="bold">
                    {label}
                </Typography>
                <List dense component="div" role="list">
                    {data.map((role) => (
                        <ListItemButton
                            key={role} // Use role as the unique key
                            onClick={() => handleSelect(role, column)}
                            selected={selected.includes(role)}
                            sx={{
                                borderRadius: 1,
                                mb: 0.5,
                                backgroundColor: selected.includes(role) 
                                    ? theme.palette.primary.light 
                                    : 'inherit',
                                color: selected.includes(role) 
                                    ? theme.palette.primary.contrastText 
                                    : 'inherit',
                                '&:hover': {
                                    backgroundColor: selected.includes(role) 
                                        ? theme.palette.primary.dark 
                                        : theme.palette.action.hover,
                                },
                            }}
                        >
                            <ListItemText primary={role} />
                        </ListItemButton>
                    ))}
                    {data.length === 0 && (
                        <Typography variant="body2" color="textSecondary" align="center">
                            No roles {column === 'A' ? 'granted' : 'available'}.
                        </Typography>
                    )}
                </List>
            </Paper>
        </Grid>
    );

    return (
        <Box sx={{ display: 'flex', padding: 2 }}>
            <Grid container spacing={3}>
                {renderColumn(columnAdata, columnAlabel, selectedFromColumnA, 'A')}

                <Grid xs={4} container direction="column" justifyContent="center" alignItems="center">
                    <Grid>
                        <Button
                            variant="contained"
                            onClick={() => transferItems('columnA')}
                            disabled={selectedFromColumnB.length === 0}
                            sx={{ mb: 1 }}
                        >
                            {'←'}
                        </Button>
                    </Grid>
                    <Grid>
                        <Button
                            variant="contained"
                            onClick={() => transferItems('columnB')}
                            disabled={selectedFromColumnA.length === 0}
                        >
                            {'→'}
                        </Button>
                    </Grid>
                </Grid>

                {renderColumn(columnBdata, columnBlabel, selectedFromColumnB, 'B')}
            </Grid>
        </Box>
    );
};
