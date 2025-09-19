import React, { useState, useEffect } from 'react';
import { MenuItemDropdown } from "@src/client/components/standard/menuitemdropdown";
import { MenuItemList } from '@src/client/components/standard/menuitemlist';
import { stateManager} from '@src/client/statemanager';
import { Public } from '@mui/icons-material';
import { PrettyDate } from '@src/common/date';
import {  
    Typography, 
    ListItem,
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    DialogActions,
    Button,
    ListItemIcon,
    ListItemText,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
  } from '@mui/material';
import { callAddGameVersion } from '@src/client/editor';
import { Add } from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useConfig } from '@src/client/configprovider';
import { analyticsReportEvent} from "@src/client/analytics";
import { nullUndefinedOrEmpty } from '../../common/objects';


export function VersionSelector(props) {
  const { Constants } = useConfig();
    const { allowNewGameOption, firstOptionUnselectable, dropdown, chooseMostRecent } = props;
    const router = useRouter();
    const { versionName } = router.query;
    const { game, versionList, version, switchVersionByName } = React.useContext(stateManager);
    const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
    // below here, "new version" logic
    const [versionMenuItems, setVersionMenuItems] = useState([]);
    const [addVersionDialogOpen, setAddVersionDialogOpen] = useState(false);
    const [newVersionName, setNewVersionName] = useState("");
    const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
    const [problem, setProblem] = useState(null);

       
    function printversionItem(version, index) {
        const accountName = version?.account?.email ? version.account.email : version.accountID;
        return (
        <ListItem key={index} sx={{ padding: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography
                variant="body1"
                color="inherit"
                >
                {version?.versionName}
                </Typography>
                <Typography
                variant="body2"
                color="textSecondary"
                style={{ marginTop: 1 }}
                >
                Last updated: {PrettyDate(version.lastUpdatedDate)}
                </Typography>
            </div>
            {version.published && (
                <Public 
                color="success"
                style={{ marginLeft: 8 }}
                />
            )}
            </div>
        </ListItem>
        );
    }

    function refreshSelectedMenuItem() {
        if (versionList) {
          for (let j=0; j < versionList.length; j++) {
            if (versionList[j].versionName == versionName) {
              setCurrentVersionIndex(firstOptionUnselectable ? j+1 : j);
              return;
            }
          }
        }
        
        setCurrentVersionIndex(-1);
      }

      useEffect(() => {
          refreshSelectedMenuItem();
      }, [version]);
      
      async function updateSelectedVersionByName(versionName) {
        Constants.debug.logSessionRestart && console.log("VersionSelector: updateSelectedVersionByName: ", versionName)
        if (versionName) {
              switchVersionByName(versionName);
        }
      };

    function updateSelectedVersionByIndex(index) {
        
        if (!firstOptionUnselectable || index > 0) {
                const indexToUse = firstOptionUnselectable ? index - 1 : index;
                const newVersion = versionList[indexToUse].versionName;
                Constants.debug.logSessionRestart && console.log("VersionSelector: updateSelectedVersionByIndex: ", index, versionName)
                switchVersionByName(newVersion);
        }
    }
    
    useEffect(() => {
        if (versionList) {
            let newMenuItems =  (game && allowNewGameOption) ? [<ListItem onClick={handleAddVersionDialogOpen}>
              <ListItemIcon>
                <Add />
              </ListItemIcon>
              <ListItemText primary="Add Version" />
            </ListItem>] :[];
            newMenuItems = [...newMenuItems, ...(versionList ? versionList?.map((version, index) => printversionItem(version, index)) : [])];
            setVersionMenuItems(newMenuItems);
            
            const currentVersionNameIsInList = nullUndefinedOrEmpty(versionName) ? false : versionList.some(version => version.versionName === versionName);
            if (!currentVersionNameIsInList) {

                //
                // If the current version name is not in the list, then we want to switch to the first version in the list
                // rather than leave the version blank
                //

                if (versionList.length === 1) {
                
                  // special case - if there's only one menu item, select it
                  Constants.debug.logSessionRestart && console.log("VersionSelector: useEffect: only one version in list, selecting it: ", versionList[0].versionName)
                  Constants.debug.logSessionRestart && console.log("VersionSelector: useEffect: only one version in list, selecting it: ", versionList)
                  switchVersionByName(versionList[0].versionName)

                } else if (versionList.length > 1 && chooseMostRecent) {
                  
                  // Find the version with the most recent lastUpdatedDate without modyfing the list
                  let sortableVersionList = [...versionList];
                  sortableVersionList.sort((a, b) => new Date(b.lastUpdatedDate) - new Date(a.lastUpdatedDate));
                  switchVersionByName(sortableVersionList[0].versionName);
                  Constants.debug.logSessionRestart && console.log("VersionSelector: useEffect: chooseMostRecent: ", sortableVersionList[0].versionName)

                }
            }
        }
    }, [versionList, game]);

    /************************* NEW VERSION "+" LOGIC ********************* */


    function handleAddVersionDialogOpen() {
      console.log("handleAddVersionDialogOpen");
      setAddVersionDialogOpen(true);
    };
  
    function handleAddVersionDialogClose() {
      console.log("handleAddVersionDialogClose");
      setAddVersionDialogOpen(false);
    };
  
    const handleAddVersion = async () => {
      console.log("gameID", game.gameID);
      var prototypeVersionName = null;
      if (versionList && selectedVersionIndex < versionList.length) {
          prototypeVersionName = versionList[selectedVersionIndex].versionName;
      }
      await callAddGameVersion(game.gameID, newVersionName, prototypeVersionName);

      analyticsReportEvent('create_version', {
        event_category: 'Editor',
        event_label: 'Create version',
        gameID: game.gameID,    // Unique identifier for the game
        versionName: newVersionName,  // Version of the game being played
      });

      handleAddVersionDialogClose();
      updateSelectedVersionByName(newVersionName);
    };
  
    function checkForProblems(text) {
      if (!hasNoUrlParts(text)) {
        setProblem("Invalid characters used in name");
      }
      if (!isUniqueVersionName(text)){
        setProblem("Version name already exists");
      }
  
      setProblem(null);
    };
  
    const hasNoUrlParts = (url) => {
      const urlPattern = /^(?!.*\/\/)[a-zA-Z0-9-_]+$/;
      return urlPattern.test(url);
    };
  
    const isUniqueVersionName = (text) => {
      return !versionList.some(version => version.versionName === text);
    };
    
  
    function handleVersionNameInput(text) {
      checkForProblems(text);
      setNewVersionName(text);
    }
  
    const addButtonEnabled = (problem == null && newVersionName.length > 0);
    
    /************************* NEW VERSION "+" LOGIC ********************* */

    return (
      <Box sx={props.sx ? props.sx : {}}>
        {dropdown 
          ? 
          <React.Fragment>
            <MenuItemDropdown title={"Version"} menuItems={versionMenuItems} onMenuItemSelected={updateSelectedVersionByIndex} selectedIndex={currentVersionIndex} />
          </React.Fragment>
          :
          <MenuItemList menuItems={versionMenuItems} onMenuItemSelected={updateSelectedVersionByIndex} selectedIndex={currentVersionIndex} />
        }
        
      
      <Dialog open={addVersionDialogOpen} onClose={handleAddVersionDialogClose}>
        <DialogTitle>Add new version</DialogTitle>
        <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          id="versionName"
          label="Version Name"
          fullWidth
          value={newVersionName}
          onChange={(e) => handleVersionNameInput(e.target.value)}
          helperText={problem}
          error={problem !== null}
        />
          <FormControl fullWidth margin="dense">
            <InputLabel id="copyFrom-label">Copy from:</InputLabel>
            <Select
              labelId="copyFrom-label"
              id="copyFrom"
              value={selectedVersionIndex}
              onChange={(e) => setSelectedVersionIndex(e.target.value)}
            >
              {versionList && versionList.map((version, index) => (
                <MenuItem key={index} value={index}>
                  {version.versionName}
                </MenuItem>
              ))}
              <MenuItem value={versionList?.length}>Blank</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddVersionDialogClose}>Cancel</Button>
        <Button onClick={handleAddVersion} disabled={!addButtonEnabled}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
          
    );
}
