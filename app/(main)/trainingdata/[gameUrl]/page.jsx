'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { makeStyles } from 'tss-react/mui';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import Title from '@src/client/components/standard/title';
import { defaultAppTheme } from '@src/common/theme';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import {  
  Box,
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  IconButton,
  Typography,
} from '@mui/material';
import { GetApp } from '@mui/icons-material';
import { callGetTrainingData } from '@src/client/responseratings';
import GameMenu from '@src/client/components/gamemenu';
import { MultiSelectDropdown } from '@src/client/components/standard/multiselectdropdown';
import { stateManager } from '@src/client/statemanager';
import { InfoBubble } from '@src/client/components/standard/infobubble';


const useStyles = makeStyles()((theme, pageTheme) => {
  const {
    colors,
    fonts,
  } = pageTheme;
  return ({
  optionsBox: {
    marginBottom: theme.spacing(2),
    backgroundColor: theme.palette.background.main , 
  },
  outputBox: {
    display: 'flex',
    flexDirection:"column",
    justifyContent: 'left',
    alignItems: "flex-start",
    flex: 1,
    flexGrow: 1,
    paddingBottom: '10px',
    backgroundColor: theme.palette.background.main, // Use the new color as the background
  },
})});

const requestTypeOptions = ['assistant', 'imagePrompt', 'compression'];
const sentimentOptions = [-1, 0, 1];

export default function Home(props) {
  const { classes } = useStyles(defaultAppTheme);
  const { loading, game, account, versionList, gamePermissions } = React.useContext(stateManager);
  const [versionNames, setVersionNames] = useState([]); 
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [selectedRequestTypes, setSelectedRequestTypes] = useState(['assistant']);
  const [selectedSentimentOptions, setSelectedSentimentOptions] = useState([-1, 0, 1]);
  const [trainingData, setTrainingData] = useState('');

  useEffect(() => {
    if (!loading && versionList && versionList.length > 0) {
      const versionNames = versionList?.map(v => v.versionName);
      setVersionNames(versionNames);
    }
  }, [versionList, loading]);
  
  useEffect(() => {
    async function updateTrainingData () {
        if (selectedVersions && selectedVersions.length > 0) {
            //
            // Call the server to get all the ratings
            //

            const versionsToSend = versionList.filter(v => selectedVersions.includes(v.versionName)).map(v => v.versionID);

            const filters = {
              versionID: versionsToSend,
              requestType: selectedRequestTypes,
            }

            let newTrainingData = await callGetTrainingData(game.gameID, filters);
            
            // Filter out the ratings that don't match the sentiment options
            // on the client for now
            newTrainingData = newTrainingData.filter(rating => selectedSentimentOptions.includes(calculateOverallRating(rating)));
            
            setTrainingData(newTrainingData);
        } else {
            setTrainingData([]);
        }
    }
    if (game) {
      updateTrainingData();
    }
  }, [selectedVersions, selectedRequestTypes, selectedSentimentOptions]);

  const handleVersionChange = (newValues) => {
    setSelectedVersions(newValues);
  };

  const handleRequestTypeChange = (newValues) => {
    setSelectedRequestTypes(newValues);
  };

  const handleSentimentOptionChange = (newValues) => {
    setSelectedSentimentOptions(newValues);
  };

  function calculateOverallRating(rating) {

    let overallRating = undefined;

    if (typeof rating.playerRating === 'number') {
      overallRating = rating.playerRating;
    }
    if (typeof rating.automationRating === 'number') {
      overallRating = rating.automationRating;
    }
    if (typeof rating.adminRating === 'number') {
      overallRating = rating.adminRating;
    } 

    if (typeof overallRating === 'undefined') {
      return 0.0;
    }

    return overallRating;
  }

  async function downloadJSON() {

    if (!trainingData) {
      return;
    }

    let formattedData = trainingData.map((rating, rowIndex) => {
      return {
        instruction: "",
        input: rating.prompt,
        output: rating.responseText,
        sentiment: calculateOverallRating(rating),
      }
    });

    const jsonData = JSON.stringify(formattedData, null, 2);

    // Convert your JSON data into a blob
    const blob = new Blob([jsonData], { type: 'application/json' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'data.json';  // The name of the downloaded file
    document.body.appendChild(a);
    a.click();

    // Remove the link and revoke the blob URL
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function escapeCSV(string) {
    string = string.replace(/"/g, '""');
    string = string.replace(/'/g, "''");
    return string;
  }

  async function downloadCSV() {

    if (!trainingData) {
      return;
    }

    let formattedData = 'Input,Output,Sentiment\n';
    trainingData.map((rating, rowIndex) => {
      formattedData += `"${escapeCSV(rating.prompt)}","${escapeCSV(rating.responseText)}",${calculateOverallRating(rating)}\n`;
    });


    // Convert your JSON data into a blob
    const blob = new Blob([formattedData], { type: 'text/csv' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'data.csv';  // The name of the downloaded file
    document.body.appendChild(a);
    a.click();

    // Remove the link and revoke the blob URL
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderTrainingData() {
    const MAX_SHOWN_ON_SCREEN = 20; 
    const NUM_SHOWN = Math.min(MAX_SHOWN_ON_SCREEN, trainingData.length);

    if (!trainingData) {
      return null;
    }

    return (
     <TableContainer>
       <Typography variant="caption" sx={{padding: 1}}>Showing {NUM_SHOWN} of {trainingData.length} results</Typography>
       <Table>
         <TableHead>
           <TableRow>
               <TableCell key="Prompt">prompt</TableCell>
               <TableCell key="Response">response</TableCell>
               <TableCell key="Overall rating">Overall rating</TableCell>
           </TableRow>
         </TableHead>
         <TableBody>
           {trainingData.map((rating, rowIndex) => {
              if (rowIndex < MAX_SHOWN_ON_SCREEN) {
                let overallRating = calculateOverallRating(rating);
                
                return (
                <TableRow key={rowIndex}>
                  <TableCell key={"prompt" + rowIndex}>{rating.prompt}</TableCell>
                  <TableCell key={"response"+rowIndex}>{rating.responseText}</TableCell>
                  <TableCell key={"overallrating"+rowIndex}>{overallRating}</TableCell>
                </TableRow>
                );
              }
            })}
         </TableBody>
       </Table>
     </TableContainer>
     );
  }

  function renderWithFormatting(children) {
    return (
      <StandardContentArea>
          <InfoBubble>
            {children}
          </InfoBubble>
      </StandardContentArea>
    );
  }

  return (
    <RequireAuthentication>
      <DefaultLayout  title={!game ? "Loading" : `Training data for ${game?.title}`}>
      <StandardContentArea>
        
       {(loading || !game || !account || !gamePermissions) ? renderWithFormatting(<h1>Loading...</h1>) 
            : (!gamePermissions.includes('game_viewTrainingData') ?
              renderWithFormatting(<h1>You are not authorized to view training data for this game.</h1>)
              : (
            <Box sx={{flex: 1, width: '100%', height: '100%'}}>
                <Box className={classes.optionsBox}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 2 }}>
                    <Box display="flex" justifyContent="flex-start" alignItems="center" marginBottom={2}>
                      <MultiSelectDropdown
                      theme={defaultAppTheme}
                      label="Versions"
                      options={versionNames} 
                      selected={selectedVersions}
                      onChange={handleVersionChange}
                      sx={{ minWidth: 200, padding: 1 }} 
                      />
                      
                      <MultiSelectDropdown
                      theme={defaultAppTheme}
                      label="Request Type"
                      options={requestTypeOptions} 
                      selected={selectedRequestTypes}
                      onChange={handleRequestTypeChange}
                      sx={{ minWidth: 200, padding: 1 }} 
                      />

                      <MultiSelectDropdown
                      theme={defaultAppTheme}
                      label="Sentiment"
                      options={sentimentOptions} 
                      selected={selectedSentimentOptions}
                      onChange={handleSentimentOptionChange}
                      sx={{ minWidth: 100, padding: 1 }} 
                      />

                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding:1}}>
                        <Typography variant='caption' >JSON</Typography>
                        <IconButton color="primary" onClick={downloadJSON}>
                          <GetApp />
                        </IconButton>
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding:1}}>
                        <Typography variant='caption'>CSV</Typography>
                        <IconButton color="primary" onClick={downloadCSV}>
                          <GetApp />
                        </IconButton>
                      </Box>
                    </Box>
                </Box>
                <Box 
                className={classes.outputBox}
                >
                    {renderTrainingData()}
                  </Box>
                </Box>
            </Box>
        ))}
      </StandardContentArea>
      <GameMenu 
                url={game} 
                theme={defaultAppTheme}
                allowEditOptions  
                includePlayOption
            />
      </DefaultLayout>
    </RequireAuthentication> 
  );
}

