import React, { useState, useEffect } from 'react';
import { defaultAppTheme } from '@src/common/theme';
import { makeStyles } from 'tss-react/mui';
import { 
  Delete, 
  Edit, 
  Add, 
  Save, 
  Clear, 
  Close,
 } from '@mui/icons-material';
import {
  TextField,
  Button,
  Box,
  Paper, 
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Grid,
  Divider,
  CircularProgress,
} from '@mui/material';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { FileDropZone } from '@src/client/components/standard/filedropzone';
import { callUploadBlob } from '@src/client/blobclient';


const useStyles = makeStyles()((theme, pageTheme) => {
  const { colors } = pageTheme;
  return ({
    themeEditorContainer: {
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.palette.primary.main,
      borderStyle: 'solid',
      borderRadius: theme.shape.borderRadius,
      backgroundColor: theme.palette.background.main,
      marginTop: theme.spacing(4),
      width: '100%',
    },
    themeEditorTitle: {
      marginBottom: theme.spacing(2),
    },
    fileItemStyle: {
      padding: '8px',
      marginBottom: '8px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      backgroundColor: colors.inputAreaTextEntryBackgroundColor,
    },
    filePlaceholder: {
      border: '1px dashed #ccc',
      borderRadius: '4px',
      padding: '16px',
      textAlign: 'center',
      backgroundColor: '#f0f0f0',
    },
    fileInputArea: {
      display: 'flex',
      flexDirection: 'column',
      marginBottom: theme.spacing(2),
    },
    inputRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(1),
    },
    urlInput: {
      flex: 1,
      marginRight: theme.spacing(1),
    },
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
    divider: {
      height: '100%',
      margin: `0 ${theme.spacing(1)}`,
    },
    clearButton: {
      alignSelf: 'flex-start',
    },
    inputLabel: {
      fontWeight: 'bold',
      marginBottom: theme.spacing(1),
    },
    inputField: {
      marginBottom: theme.spacing(2),
    },
  });
});

export function FileStoreEditor(props) {
  const { classes } = useStyles(defaultAppTheme);
  const { readOnly, rootObject, relativePath } = props;
  const [editingFileIndex, setEditingFileIndex] = useState(null);
  const [filesState, setFilesState] = useState(props.files || []);
  const [url, setUrl] = useState('');
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [currentFileName, setCurrentFileName] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    props.onChange(rootObject, relativePath, filesState);
  }, [filesState]);

  const getNextAvailableFileName = () => {
    let i = 1;
    while (true) {
      const fileName = `file${i}`;
      if (!filesState.some(file => file.fileName === fileName)) {
        return fileName;
      }
      i++;
    }
  };

  const getMimeTypeFromExtension = (extension) => {
    switch (extension) {
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'ogg':
        return 'audio/ogg';
      case 'webm':
        return 'audio/webm';
      case 'mp4':
        return 'video/mp4';
      case 'mpeg':
        return 'video/mpeg';
      case 'webm':
        return 'video/webm';
      case 'ogv':
        return 'video/ogg';
      case 'jpg':
        return 'image/jpeg';
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'svg':
        return 'image/svg+xml';
      case 'pdf':
        return 'application/pdf';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'ppt':
        return 'application/vnd.ms-powerpoint';
      case 'pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case 'txt':
        return 'text/plain';
      case 'html':
        return 'text/html';
      case 'xml':
        return 'text/xml';
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      case 'zip':
        return 'application/zip';
      case 'tar':
        return 'application/x-tar';
      case 'gz':
        return 'application/gzip';
      default:
        return 'application/octet-stream';
    }
  };

  const handleAddFile = () => {
    const newFileName = getNextAvailableFileName();
    const newFile = { 
      fileName: newFileName, 
      file: {},
    };
    setFilesState((prevState) => [...prevState, newFile]);
    const newIndex = filesState.length;
    setEditingFileIndex(newIndex);
    setUrl('');
    setFileToUpload(null);
  };

  const handleEditFile = (index) => {
    const fileToEdit = filesState[index];
    setEditingFileIndex(index);
    if (fileToEdit.file) {
      if (fileToEdit.file.source === 'storage') {
        setFileToUpload({ name: fileToEdit.fileName, type: fileToEdit.file.mimeType });
        setUrl('');
      } else if (fileToEdit.file.source === 'url') {
        setUrl(fileToEdit.file.data);
        setFileToUpload(null);
      }
    } else {
      setFileToUpload(null);
      setUrl('');
    }
  };

  const handleDeleteFile = (index) => {
    setFilesState((prevState) => {
      let newState = [...prevState];
      newState.splice(index, 1);
      return newState;
    });
  };

  const handleFileNameChange = (index, value) => {
    setFilesState((prevState) => {
      let newState = [...prevState];
      // Check if the new file name already exists
      if (newState.some((file, i) => i !== index && file.fileName === value)) {
        // If it exists, don't change the name
        return newState;
      }
      newState[index].fileName = value;
      return newState;
    });
    setHasUnsavedChanges(true);
  };

  const handleDescriptionChange = (index, value) => {
    setFilesState((prevState) => {
      let newState = [...prevState];
      newState[index].description = value;
      return newState;
    });
    setHasUnsavedChanges(true);
  };

  const handleFinishEditing = async () => {
    const index = editingFileIndex;
    const currentFile = filesState[index];
  
    if (!currentFile.fileName || currentFile.fileName.trim().length === 0) {
      const newFileName = getNextAvailableFileName();
      handleFileNameChange(index, newFileName);
    }
  
    setUploading(index);
  
    try {
      let uploadResult;
      if (fileToUpload && fileToUpload instanceof File) {
        // Only upload if it's a new file
        
        uploadResult = await callUploadBlob(fileToUpload, currentFile.fileName);
  
        if (uploadResult) {
          setFilesState((prevState) => {
            let newState = [...prevState];
            newState[index] = {
              ...newState[index],
              file: {
                data: uploadResult.blobID,
                mimeType: uploadResult.mimeType,
                source: 'storage'
              },
            };
            return newState;
          });
        }
      } else if (url && url !== currentFile.file?.data) {
        // Only update if the URL has changed
        const fileExtension = url.split('.').pop().toLowerCase();
        const mimeType = getMimeTypeFromExtension(fileExtension); // Implement this function
        setFilesState((prevState) => {
          let newState = [...prevState];
          newState[index] = {
            ...newState[index],
            file: {
              data: url,
              mimeType: mimeType,
              source: 'url'
            },
          };
          return newState;
        });
      }
      // If neither fileToUpload nor url has changed, we don't need to do anything
      setHasUnsavedChanges(false);
      setEditingFileIndex(null);
      setFileToUpload(null);
      setUrl('');
    } catch (error) {
      console.error("Error uploading file:", error);
      alert(`Error uploading file: ${error.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleFileDrop = (file) => {
    setFileToUpload(file);
    setUrl('');
    if (editingFileIndex !== null) {
      const suggestedName = file.name;
      handleFileNameChange(editingFileIndex, suggestedName);
    }
    setHasUnsavedChanges(true);
  };
  
  const handleUrlChange = (event) => {
    const newUrl = event.target.value;
    setUrl(newUrl);
    setFileToUpload(null);
    if (editingFileIndex !== null) {
      const suggestedName = newUrl.split('/').pop().split('#')[0].split('?')[0];
      handleFileNameChange(editingFileIndex, suggestedName);
    }
    setHasUnsavedChanges(true);
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      const confirmCancel = window.confirm("You have unsaved changes. Are you sure you want to cancel?");
      if (!confirmCancel) {
        return;
      }
    }
  
    if (editingFileIndex !== null) {
      if (filesState[editingFileIndex].file && Object.keys(filesState[editingFileIndex].file).length === 0) {
        setFilesState((prevState) => prevState.filter((_, index) => index !== editingFileIndex));
      }
      setEditingFileIndex(null);
      setFileToUpload(null);
      setUrl('');
      setHasUnsavedChanges(false);
    }
  };

  const handleClearFile = () => {
    setFileToUpload(null);
    setUrl('');
    if (editingFileIndex !== null) {
      setFilesState((prevState) => {
        let newState = [...prevState];
        newState[editingFileIndex] = {
          ...newState[editingFileIndex],
          file: {},
        };
        return newState;
      });
    }
  };

  return (
    <Box className={classes.themeEditorContainer}>
      <Typography variant="h6" className={classes.themeEditorTitle}>
        File Store
      </Typography>
      <List>
        {filesState.map((file, index) => (
          <Paper key={index} className={classes.fileItemStyle}>
            <ListItem>
              {editingFileIndex === index ? (
                <Grid container alignItems="flex-start">
                  <Grid item xs={12} className={classes.inputField}>
                    <Typography className={classes.inputLabel}>File Name:</Typography>
                    <TextField
                      fullWidth
                      value={file.fileName}
                      placeholder="Enter file name"
                      onChange={(e) => handleFileNameChange(index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") {
                          handleFinishEditing();
                        }
                      }}
                      disabled={readOnly}
                    />
                  </Grid>
                  <Grid item xs={12} className={classes.inputField}>
                    <Typography className={classes.inputLabel}>Description / Keywords:</Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      value={file.description || ''}
                      placeholder="Enter description or keywords"
                      onChange={(e) => handleDescriptionChange(index, e.target.value)}
                      disabled={readOnly}
                    />
                  </Grid>
                  <Grid item xs={12} margin={1}><Grid item xs={12} margin={1}>
                    <Box className={classes.fileInputArea}>
                      <Typography className={classes.inputLabel}>File Source:</Typography>
                      <Box className={classes.inputRow}>
                        {(nullUndefinedOrEmpty(fileToUpload) && !file.file?.source) && (
                          <TextField
                            className={classes.urlInput}
                            label="Paste a URL here"
                            value={url}
                            onChange={handleUrlChange}
                            disabled={readOnly || !!fileToUpload}
                          />
                        )}
                        {(nullUndefinedOrEmpty(url) && !file.file?.source) && (
                          <Divider orientation="vertical" flexItem className={classes.divider} />
                        )}
                        {(nullUndefinedOrEmpty(url) && !file.file?.source) && (
                          <FileDropZone
                            onFileDrop={handleFileDrop}
                            file={fileToUpload}
                            disabled={readOnly}
                          />
                        )}
                        {file.file?.source === 'storage' && (
                          <Typography>
                            File uploaded: {file.fileName} (Blob ID: {file.file.data})
                          </Typography>
                        )}
                        {file.file?.source === 'url' && (
                          <Typography>
                            URL: {file.file.data}
                          </Typography>
                        )}
                      </Box>
                      {(url || fileToUpload || file.file) && (
                        <IconButton 
                          onClick={handleClearFile} 
                          disabled={readOnly}
                          className={classes.clearButton}
                        >
                          <Clear />
                        </IconButton>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={1}>
                  {uploading === index ? (
                    <CircularProgress size={24} />
                  ) : (
                    <>
                      <IconButton 
                        onClick={() => handleFinishEditing()} 
                        disabled={readOnly || uploading !== null || !file.fileName || file.fileName.trim().length === 0 || (nullUndefinedOrEmpty(fileToUpload) && nullUndefinedOrEmpty(url))}
                      >
                        <Save />
                      </IconButton>
                      <IconButton 
                        onClick={handleCancelEdit} 
                        disabled={uploading !== null}
                      >
                        <Close />
                      </IconButton>
                  </>
                  )}
                </Grid>
                  </Grid>
                </Grid>
              ) : (
                <React.Fragment>
                  <ListItemText 
                    primary={file.fileName} 
                    secondary={file.description || "No description"}
                    onClick={() => handleEditFile(index)}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleEditFile(index)} disabled={readOnly}>
                      <Edit />
                    </IconButton>
                    <IconButton edge="end" onClick={() => handleDeleteFile(index)} disabled={readOnly}>
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </React.Fragment>
              )}
            </ListItem>
          </Paper>
        ))}
      </List>
      <Button
        variant="contained"
        color="primary"
        onClick={handleAddFile}
        startIcon={<Add />}
        disabled={readOnly}
      >
        Add File
      </Button>
    </Box>
  );
}