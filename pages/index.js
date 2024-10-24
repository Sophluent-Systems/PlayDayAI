import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Link,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { ExpandMore, Add, Lightbulb, MoreVert, ArrowUpward, ArrowDownward, AccountTree, RocketLaunch, Group } from '@mui/icons-material';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { InfoBubble } from '@src/client/components/standard/infobubble';
import { useRouter } from 'next/router';
import { stateManager } from '@src/client/statemanager';
import { GameMenuDropdown } from '@src/client/components/gamemenudropdown';
import { callGetGamesList, callUpdateGameInfo } from '@src/client/gameplay';
import { defaultGetServerSideProps } from '@src/client/prerender';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { callCreateNewGame } from '@src/client/gameplay';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  heroSection: {
    position: 'relative',
    color: theme.palette.text.primary,
    backgroundColor: '#041834',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: theme.spacing(8, 2), // Updated to match featureSection
    textAlign: 'center',
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
  },
  logo: {
    width: '100%',
    maxWidth: '300px',
    margin: '0 auto',
    marginBottom: theme.spacing(6),
    display: 'block',
  },
  featureSection: {
    padding: theme.spacing(8, 2),
    backgroundColor: theme.palette.background.paper,
  },
  featureCard: {
    textAlign: 'center',
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    height: 180,
  },
  featureIcon: {
    fontSize: '3rem',
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(1),
  },
  sectionHeader: {
    textAlign: 'center',
    width: '100%',
    margin: theme.spacing(4, 0),
    fontWeight: 'bold',
  },
  featuredAppsSection: {
    width: '100%',
    margin: '50px auto',
    maxWidth: '1200px',
  },
  myAppsSection: {
    width: '100%',
    margin: '50px auto',
    maxWidth: '1200px',
  },
  allAppsSection: {
    width: '100%',
    margin: '50px auto',
    maxWidth: '1200px',
  },
  appGrid: {
    width: '100%',
  },
  appCard: {
    padding: theme.spacing(2),
    margin: theme.spacing(1),
    borderRadius: '8px',
    backgroundColor: theme.palette.background.default,
    boxShadow: theme.shadows[2],
    transition: 'transform 0.2s',
    '&:hover': {
      transform: 'scale(1.02)',
    },
  },
  addAppButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80px',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.common.white,
    borderRadius: '8px',
    margin: '20px auto',
    boxShadow: theme.shadows[2],
    transition: 'background-color 0.3s',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  tipStyle: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(1),
    borderRadius: '5px',
    marginTop: theme.spacing(2),
  },
  ctaBanner: {
    padding: theme.spacing(6, 2),
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    textAlign: 'center',
  },
  ctaButton: {
    marginTop: theme.spacing(2),
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.secondary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.secondary.dark,
    },
  },
  footer: {
    padding: theme.spacing(1, 2),
    marginTop: theme.spacing(6),
    backgroundColor: theme.palette.background.paper,
    textAlign: 'center',
  },
  footerLinks: {
    margin: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  expandButton: {
    marginTop: theme.spacing(2),
  },
}));

export default function Home(props) {
  const { classes } = useStyles();
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [anchorEditMenus, setAnchorEditMenus] = useState({});
  const { loading, account, editMode, startNewGameSession, versionm, accountHasRole } = React.useContext(stateManager);
  const [selectedGameUrl, setSelectedGameUrl] = useState(null);
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  const [showMenuIcon, setShowMenuIcon] = useState({});
  const [showAllApps, setShowAllApps] = useState(false);
  const showMenuIconRef = useRef({});
  const [addGameDialogOpen, setAddGameDialogOpen] = useState(false);
  const [newGameTitle, setNewGameTitle] = useState("");
  const [newGameUrl, setNewGameUrl] = useState("");
  const [myGames, setMyGames] = useState([]);
  const [othersGames, setOthersGames] = useState([]);
  const [featuredGames, setFeaturedGames] = useState([]);
  const featuredGamesRef = useRef([]);
  const isAdmin = accountHasRole("admin");
  const isCreator = isAdmin || accountHasRole("creator")


  const handleAddGameDialogOpen = () => {
    setAddGameDialogOpen(true);
  };

  const handleAddGameDialogClose = () => {
    setAddGameDialogOpen(false);
  };

  const handleAddGame = async () => {
    await callCreateNewGame(newGameTitle, newGameUrl);
    handleAddGameDialogClose();
    console.log(`router.push(/editgameversions/${newGameUrl});`)
    router.push(`/editgameversions/${newGameUrl}`);
  };

  const canAddGame = () => {
    return newGameTitle.length > 0 && hasNoUrlParts(newGameUrl);
  };

  const hasNoUrlParts = (url) => {
    const urlPattern = /^(?!.*\/\/)[a-zA-Z0-9-_]+$/;
    return urlPattern.test(url);
  };

  const handleEditMenuClose = () => {
    setAnchorEditMenus({});
  };

  const updateFeaturedGames = (updatedFeaturedGames) => {
    // Sort the featured games by their index
    let newSortedGames = [...updatedFeaturedGames];
    newSortedGames.sort((a, b) => a.featuredIndex - b.featuredIndex);
  
    // Update the ref (source of truth)
    featuredGamesRef.current = newSortedGames;

    // Update the state for rendering
    setFeaturedGames(newSortedGames);

    return newSortedGames;
  };

  const setNewFeaturedIndexForGame = async (game, newFeaturedIndex) => {
    game.featuredIndex = newFeaturedIndex;    
    await callUpdateGameInfo({ gameID: game.gameID, featuredIndex: newFeaturedIndex });
    
    // Update the ref immediately
    const gameIndex = featuredGamesRef.current.findIndex(g => g.gameID === game.gameID);
    if (gameIndex !== -1) {
      featuredGamesRef.current[gameIndex].featuredIndex = newFeaturedIndex;
    } else if (newFeaturedIndex > 0) {
      featuredGamesRef.current.push({...game, featuredIndex: newFeaturedIndex});
    }
  };

  const handleToggleFeatured = async (gameID) => {
    const gameToUpdate = games.find(g => g.gameID === gameID);
    const wasFeatured = gameToUpdate.featuredIndex > 0;
    const featuredIndex = wasFeatured ? 0 : featuredGamesRef.current.length + 1;

    if (wasFeatured) {
      // Remove from featured
      featuredGamesRef.current = featuredGamesRef.current.filter(g => g.gameID !== gameID);

      // Reindex remaining featured games
      for (let i = 0; i < featuredGamesRef.current.length; i++) {
        await setNewFeaturedIndexForGame(featuredGamesRef.current[i], i + 1);
      }
    } else {
      // Add to featured
      featuredGamesRef.current.push({...gameToUpdate, featuredIndex: featuredIndex});
    }

    await setNewFeaturedIndexForGame(gameToUpdate, featuredIndex);

    // Update the state for rendering
    updateFeaturedGames(featuredGamesRef.current);
  };

  const handleMoveFeatured = async (game, direction) => {
    const currentIndex = featuredGamesRef.current.findIndex(g => g.gameID === game.gameID);
    
    if ((direction === 'up' && currentIndex > 0) || (direction === 'down' && currentIndex < featuredGamesRef.current.length - 1)) {
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      // Swap the games in the ref
      [featuredGamesRef.current[currentIndex], featuredGamesRef.current[newIndex]] = 
        [featuredGamesRef.current[newIndex], featuredGamesRef.current[currentIndex]];
      
      // Update indices
      await setNewFeaturedIndexForGame(featuredGamesRef.current[currentIndex], currentIndex + 1);
      await setNewFeaturedIndexForGame(featuredGamesRef.current[newIndex], newIndex + 1);

      // Update the state for rendering
      updateFeaturedGames(featuredGamesRef.current);
    }
  };

  useEffect(() => {
    async function fetchGamesList() {
      const games = await callGetGamesList();
      if (games) {
        let newMyGames = [];
        let newOthersGames = [];
        let newFeaturedGames = [];

        games.forEach((game) => {
          if (game.featuredIndex > 0) {
            newFeaturedGames.push(game);
          }
          if (game.creatorAccountID == account.accountID) {
            newMyGames.push(game);
          } else {
            newOthersGames.push(game);
          }
        });

        newFeaturedGames.sort((a, b) => a.featuredIndex - b.featuredIndex);

        featuredGamesRef.current = newFeaturedGames;
        setFeaturedGames(newFeaturedGames);
        setMyGames(newMyGames);
        setOthersGames(newOthersGames);
        setGames(games);
      }
    }
    
    if (!loading && account) {
      fetchGamesList(isCreator);
    }
  }, [loading, account]);


  const handleEditMenuClick = (event, gameUrl) => {
    event.preventDefault();
    setSelectedGameUrl(gameUrl);
    let newAnchorEditMenus = {...anchorEditMenus};
    newAnchorEditMenus[gameUrl] = event.currentTarget;
    setAnchorEditMenus(newAnchorEditMenus);
  };
  
  function handleUpdateMenuIcon(gameUrl, menuOptions) {
    showMenuIconRef.current = {...showMenuIconRef.current};
    showMenuIconRef.current[gameUrl] = menuOptions && menuOptions.length > 0;
    setShowMenuIcon({...showMenuIconRef.current});
  }
  
  const handleConfirmModalClose = () => {
    setOpenConfirmModal(false);
  };

  const handleRestartGame = async () => {
    const newSession = await startNewGameSession();
    handleConfirmModalClose();
    const versionString = version?.versionName ? `versionName=${version?.versionName}` : '';
    router.push(`/play/${selectedGameUrl}?${versionString}&sessionID=${newSession.sessionID}`);
  };
  


  
  const renderApp = (app, index, isFeatured = false) => {
    const playUrl = `/play/${app.url}`;

    return (
      <Grid size={4} key={index}>
        <Paper className={classes.appCard}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h6" color="text.primary">
                <Link href={playUrl} color="inherit" underline="hover">{app.title}</Link>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {app.description}
              </Typography>
            </Box>
            <Box>
              {isAdmin && isFeatured && (
                <>
                  <IconButton onClick={() => handleMoveFeatured(app, 'up')} disabled={index === 0}>
                    <ArrowUpward />
                  </IconButton>
                  <IconButton onClick={() => handleMoveFeatured(app, 'down')} disabled={index === featuredGames.length - 1}>
                    <ArrowDownward />
                  </IconButton>
                </>
              )}
              {(isAdmin) && (
                <IconButton edge="end" aria-label="more" onClick={(event) => handleEditMenuClick(event, app.url)}>
                  <MoreVert />
                </IconButton>
              )}
              <GameMenuDropdown
                onMenuClose={() => handleEditMenuClose(app.url)}
                anchor={anchorEditMenus[app.url]}
                gameUrl={app.url}
                gameID={app.gameID}
                allowEditOptions={true}
                includePlayOption={true}
                onToggleFeatured={(gameID) => handleToggleFeatured(gameID)}
                isFeatured={app.featuredIndex && app.featuredIndex > 0}
              />
            </Box>
          </Box>
        </Paper>
      </Grid>
    );
  };

  return (
    <DefaultLayout>
      <RequireAuthentication>
        {(!loading && account && games) ? (

          <StandardContentArea>
          {/* Hero Section */}
          <Box className={classes.heroSection}>
            <Box className={classes.overlay} />
            <Box className={classes.heroContent}>
              {/* Add the logo here */}
              <img src="/hero_image.png" alt="Logo Banner" className={classes.logo} />                

              <Typography variant="h2" gutterBottom>
                Build AI Apps Visually in Minutes
              </Typography>
              <Typography variant="h5" gutterBottom>
                Empower your creativity with our rapid AI prototyping tool.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                size="large"
                sx={{ marginTop: 4 }}
                onClick={handleAddGameDialogOpen}
              >
                Get Started
              </Button>
            </Box>
          </Box>

          {/* Features Section */}
          <Box className={classes.featureSection}>
            <Typography
              variant="h3"
              className={classes.sectionHeader}
              align="center"
            >
              Why Choose PlayDay.ai?
            </Typography>
            <Grid container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }}>
              <Grid size={4}>
                <Box className={classes.featureCard}>
                  <AccountTree className={classes.featureIcon} color="primary" fontSize="large" />
                  <Typography variant="h6">Visual Editor</Typography>
                  <Typography variant="body2">
                    Design AI interactions without writing code.
                  </Typography>
                </Box>
              </Grid>
              <Grid size={4}>
                <Box className={classes.featureCard}>
                  <RocketLaunch className={classes.featureIcon} color="primary" fontSize="large" />
                  <Typography variant="h6">Rapid Deployment</Typography>
                  <Typography variant="body2">
                    Deploy your app to the web instantly.
                  </Typography>
                </Box>
              </Grid>
              <Grid size={4}>
                <Box className={classes.featureCard}>
                  <Group className={classes.featureIcon} color="primary" fontSize="large" />
                  <Typography variant="h6">Developer Community</Typography>
                  <Typography variant="body2">
                    Join a thriving community of innovators.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>



            {/* Featured Apps section */}
            {featuredGames.length > 0 && (
              <Box className={classes.featuredAppsSection}>
                <Typography variant="h3" className={classes.sectionHeader}>
                  Featured Apps
                </Typography>
                <Grid container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }}  className={classes.appGrid}>
                  {featuredGames.map((game, index) => renderApp(game, index, true))}
                </Grid>
              </Box>
            )}

            {/* My Apps section */}
            <Box className={classes.myAppsSection}>
              <Typography variant="h3" className={classes.sectionHeader}>
                My Apps
              </Typography>
              <Grid container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }} className={classes.appGrid}>
                {myGames.map((game, index) => (game.creatorAccountID == account.accountID) ? renderApp(game, index) : null)}
              </Grid>
              {myGames.length === 0 && (
                <Box className={classes.tipStyle}>
                  <Lightbulb color="secondary" />
                  <Typography variant="body1" sx={{ ml: 1 }}>
                    We suggest you start here by creating a new App
                  </Typography>
                </Box>
              )}

            {isCreator && (
              <Button className={classes.addAppButton} onClick={handleAddGameDialogOpen}>
                <Add /> New App
              </Button>
            )}
            </Box>

            {/* All Apps section */}
            <Box className={classes.allAppsSection}>
              <Typography variant="h3" className={classes.sectionHeader}>
                All Apps
              </Typography>
              <Box display="flex" justifyContent="center">
                <Button
                  onClick={() => setShowAllApps(!showAllApps)}
                  endIcon={<ExpandMore sx={{
                    transition: 'transform 0.3s',
                    transform: showAllApps ? 'rotate(180deg)' : 'none',
                  }} />}
                  variant="outlined"
                  sx={{
                    marginBottom: 2,
                    minWidth: '200px'
                  }}
                >
                  {showAllApps ? 'Show Less' : 'Show All Apps'}
                </Button>
              </Box>
              {showAllApps && (
                <Grid container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }} className={classes.appGrid}>
                  {othersGames.map((game, index) => (game.creatorAccountID != account.accountID) ? renderApp(game, index) : null)}
                </Grid>
              )}
            </Box>

          {/* CTA Banner */}
          <Box className={classes.ctaBanner}>
            <Typography variant="h4" gutterBottom>
              Ready to bring your AI ideas to life?
            </Typography>
            <Button
              variant="contained"
              size="large"
              className={classes.ctaButton}
              onClick={handleAddGameDialogOpen}
            >
              Start Creating
            </Button>
          </Box>

          {/* Footer */}
          <Box className={classes.footer}>
            <Link href="https://docs.google.com/document/d/1FtpERx7EtV0420Gl2h4MGUh1O9lwjccS3S4Owai5yE8" target="_blank" rel="noopener" className={classes.footerLinks}>
              Getting Started Guide
            </Link>
            <Link href="https://discord.gg/6St8WtpZWt" target="_blank" rel="noopener" className={classes.footerLinks}>
              Discord Community
            </Link>
            <Link href="/static/privacy" className={classes.footerLinks}>
              Privacy Policy
            </Link>
            <Link href="/static/terms" className={classes.footerLinks}>
              Terms of Use
            </Link>
            <Link href="/static/about" className={classes.footerLinks}>
              About
            </Link>
            <Link href="https://github.com/tomlangan/GameGPT" className={classes.footerLinks}>
              Github
            </Link>
            <Typography variant="body2" color="text.secondary" sx={{ marginTop: 2 }}>
              © {new Date().getFullYear()} PlayDay.ai
            </Typography>
          </Box>
          </StandardContentArea>
        ) : (
          <StandardContentArea>
            <h1>Loading apps list...</h1>
          </StandardContentArea>
        )}

        {/* Dialogs */}
        <Dialog open={openConfirmModal} onClose={handleConfirmModalClose}>
          <DialogTitle>{"Delete Session"}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete your app session? There is no way to get it back.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleConfirmModalClose} color="primary">Cancel</Button>
            <Button onClick={handleRestartGame} color="primary" autoFocus>Confirm</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={addGameDialogOpen} onClose={handleAddGameDialogClose}>
          <DialogTitle>Create New App</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              id="title"
              label="Title"
              fullWidth
              value={newGameTitle}
              onChange={(e) => setNewGameTitle(e.target.value)}
            />
            <TextField
              margin="dense"
              id="url"
              label="URL"
              fullWidth
              value={newGameUrl}
              onChange={(e) => setNewGameUrl(e.target.value)}
              helperText="No forward slashes or special URL characters"
              error={!hasNoUrlParts(newGameUrl) && newGameUrl.length > 0}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleAddGameDialogClose}>Cancel</Button>
            <Button onClick={handleAddGame} disabled={!canAddGame()}>Add</Button>
          </DialogActions>
        </Dialog>
      </RequireAuthentication>
    </DefaultLayout>
  );
}

export const getServerSideProps = defaultGetServerSideProps;