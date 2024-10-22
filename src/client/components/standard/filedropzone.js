import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { defaultAppTheme } from '@src/common/theme';
import { makeStyles } from 'tss-react/mui';
import {
  Box,
  Typography,
  Paper,
} from '@mui/material';
import { InsertDriveFile as FileIcon } from '@mui/icons-material';

const useStyles = makeStyles()((theme, pageTheme) => {
    const { colors } = pageTheme;
    return ({
      dragDropArea: {
        flex: 1,
        border: '2px dashed #ccc',
        borderRadius: '4px',
        padding: '16px',
        textAlign: 'center',
        backgroundColor: '#f0f0f0',
        cursor: 'pointer',
        transition: 'border-color 0.3s ease',
      },
    });
  });
  

export const FileDropZone = ({ onFileDrop, disabled, file }) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onFileDrop(acceptedFiles[0]);
    }
    setIsDragging(false);
  }, [onFileDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    noClick: true,
    noKeyboard: true,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  return (
    <Box
      {...getRootProps()}
      sx={{
        border: file ? '2px solid #1976d2' : '2px dashed #ccc',
        borderRadius: '4px',
        padding: '16px',
        textAlign: 'center',
        backgroundColor: file ? '#e3f2fd' : '#f0f0f0',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '120px',
        '&:hover': {
          backgroundColor: file ? '#bbdefb' : '#e0e0e0',
        },
      }}
    >
      <input {...getInputProps()} />
      {file ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <FileIcon sx={{ fontSize: 48, color: '#1976d2', mb: 1 }} />
          <Paper
            elevation={2}
            sx={{
              p: 1,
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Typography variant="body2">{file.name}</Typography>
          </Paper>
        </Box>
      ) : isDragging ? (
        <Typography>Drop the file here ...</Typography>
      ) : (
        <Typography>Drag and drop a file here</Typography>
      )}
    </Box>
  );
};