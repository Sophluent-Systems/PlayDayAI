import React, { useState, memo, useRef, useEffect } from 'react';
import { 
    Box, 
    IconButton, 
    Typography, 
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Tooltip,
    Slider,
    Popover,
    Stack,
 } from '@mui/material';
import { 
    Tune, 
    MusicNote, 
    VolumeOff, 
    VolumeUp,
    GraphicEq,
    Speed,
    VolumeDown,
 } from '@mui/icons-material';
import AudioPlayer from './audioplayer'; 
import { makeStyles } from 'tss-react/mui';
import { useConfig } from '@src/client/configprovider';
import { stateManager } from '@src/client/statemanager';

const useStyles = makeStyles()((theme, pageTheme) => {
    const {
      colors,
      fonts,
    } = pageTheme;
    return ({
    buttonStyle: {
        color: colors.sendMessageButtonActiveColor,
    },
  })});

export const AudioPlaybackControls = memo(({audioState, onGetAudioController, onAudioStateChange, theme}) => {
    const { Constants } = useConfig();
    const { classes } = useStyles(theme);

    // states
    const [bgMusicMuted, setBgMusicMuted] = useState(false);
    const [soundEffectMuted, setSoundEffectMuted] = useState(false);

    const speechControllerRef = useRef(null);
    const bgMusicControllerRef = useRef(null);
    const soundEffectControllerRef = useRef(null);    
    const [showAudioPermissionDialog, setShowAudioPermissionDialog] = useState(false);
    const [blockedAudioTypes, setBlockedAudioTypes] = useState([]);
    const { account, setAccountPreference } = React.useContext(stateManager);
    const [speechPlaybackSpeed, setSpeechPlaybackSpeed] = useState(undefined);
    const [volume, setVolume] = useState(undefined);
    const [anchorState, setAnchorState] = useState(null);
    const updatePreferencesTimeoutId = useRef(null);
    const volumeToUse = typeof volume != "undefined" ? volume : 1;
    const speechPlaybackSpeedToUse = typeof speechPlaybackSpeed != "undefined" ? speechPlaybackSpeed : 1;


    useEffect(() => {
        if (!account) return;

        const accountVolume = (typeof account.preferences?.audioVolume != "undefined") ? account.preferences.audioVolume : 0.5;
        const accountPlaybackSpeed = (typeof account.preferences?.audioPlaybackSpeed != "undefined") ? account.preferences.audioPlaybackSpeed : 1;

        if (accountVolume !== volume) {
            setVolume(accountVolume);
        }
        if (accountPlaybackSpeed !== speechPlaybackSpeed) {
            setSpeechPlaybackSpeed(accountPlaybackSpeed);
        }
    }, [account]);

    function updatePreferenceOnTimer(preferenceName, newValue) {
        if (updatePreferencesTimeoutId.current) {
            clearTimeout(updatePreferencesTimeoutId.current);
            updatePreferencesTimeoutId.current = null;
        }

        updatePreferencesTimeoutId.current = setTimeout(() => {
            setAccountPreference(preferenceName, newValue);
            updatePreferencesTimeoutId.current = null;
        }, 500);
    }

    const handleSpeedChange = (speed) => {
        if (speed !== speechPlaybackSpeed && typeof speechPlaybackSpeed != "undefined") {
            setSpeechPlaybackSpeed(speed);
            updatePreferenceOnTimer('audioPlaybackSpeed', speed);
        }
    };

    const handleVolumeChange = (event, newValue) => {
        if (newValue !== volume && typeof volume != "undefined") {
            setVolume(newValue);
            updatePreferenceOnTimer('audioVolume', newValue);
        }
    };

    const handleAudioPlayerStateChange = (audioType, state) => {
        onAudioStateChange(audioType, state);
    };

    const controller = (audioType, action) => {
        console.log('controller', audioType, action);
    
        let controllerRef;
        switch (audioType) {
            case 'speech':
                Constants.debug.logAudioPlayback && console.log('  -> Speech controller');
                controllerRef = speechControllerRef;
                break;
            case 'backgroundMusic':
                Constants.debug.logAudioPlayback && console.log('  -> Background music controller');
                controllerRef = bgMusicControllerRef;
                break;
            case 'soundEffect':
                Constants.debug.logAudioPlayback && console.log('  -> Sound effect controller');
                controllerRef = soundEffectControllerRef;
                break;
            default:
                console.error('Unknown audio type:', audioType);
                return;
        }
        
        if (controllerRef.current) {
            Constants.debug.logAudioPlayback && console.log('  -> action:', action);
            switch (action) {
                case 'play':
                    if ((bgMusicMuted && audioType == 'backgroundMusic') ||
                        (soundEffectMuted && audioType == 'soundEffect')) {
                            console.log(`${audioType} audio is muted, not playing`);
                            return;
                    } else {
                        controllerRef.current.play();
                    }
                    break;
                case 'pause':
                    controllerRef.current.pause();
                    break;
                case 'stop':
                    controllerRef.current.stop();
                    break;
                case 'setVolume':
                    controllerRef.current.setVolume(action.volume);
                    break;
                case 'seekTo':
                    controllerRef.current.seekTo(action.seekTo);
                    break;
                default:
                    console.error('Unknown action:', action);
                    break;
            }
        }
    };

    useState(() => {
        if (onGetAudioController) {
            onGetAudioController(controller);
        }
    }, [onGetAudioController]);


    const muteAudio = (audioType) => {
        if (audioType === 'backgroundMusic' && bgMusicControllerRef.current) {
            bgMusicControllerRef.current.pause();
            setBgMusicMuted(true);
        }
        if (audioType === 'soundEffect' && soundEffectControllerRef.current) {
            soundEffectControllerRef.current.pause();
            setSoundEffectMuted(true);
        }
        if (audioType === 'speech' && speechControllerRef.current) {
            speechControllerRef.current.pause();
        }
    };

    const unMuteAudio = (audioType) => {
        if (audioType === 'backgroundMusic' && bgMusicControllerRef.current) {
            bgMusicControllerRef.current.play();
            setBgMusicMuted(false);
        }
        if (audioType === 'soundEffect' && soundEffectControllerRef.current) {
            soundEffectControllerRef.current.play();
            setSoundEffectMuted(false);
        }
        if (audioType === 'speech' && speechControllerRef.current) {
            speechControllerRef.current.play();
        }
    };

    const handleAllowBackgroundAudio = () => {
        blockedAudioTypes.forEach(audioType => {
            unMuteAudio(audioType);
        });
        setBlockedAudioTypes([]);
        setShowAudioPermissionDialog(false);
    };

const handleOptOutBackgroundAudio = () => {
    blockedAudioTypes.forEach(audioType => {
        muteAudio(audioType);
    });
    setBlockedAudioTypes([]);
    setShowAudioPermissionDialog(false);
};

    const onBrowserBlockedPlayback = (audioType) => {
        console.log('Browser blocked playback for', audioType);
        setBlockedAudioTypes(prev => [...new Set([...prev, audioType])]);
        setShowAudioPermissionDialog(true);
    };

    if (!audioState) {
        return null;
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', height: 40, width: '100%' }}>
            {(audioState.backgroundMusic?.source || audioState.soundEffect?.source || audioState.speech?.source) && (
                <IconButton className={classes.buttonStyle} sx={{ marginLeft: 1, marginRight: 'auto'}}>
                    <Tune />
                </IconButton>
            )}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'center',
                flexGrow: 1, 
                minWidth: 100, 
                overflow: 'hidden',
                mx: 0,
            }}>
                
                {audioState.speech?.source && audioState.speech?.styling && (
                    <Box sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        flexGrow: 1,
                        justifyContent: 'center',
                        backgroundColor: audioState.speech.styling.backgroundColor,
                        maxWidth: 800,
                        mx: 0,
                        minWidth: 100,
                    }}>
                        <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            minWidth: 0,
                            flexGrow: 1,
                            mx: 0
                        }}>
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    flexShrink: 1,
                                    minWidth: 0,
                                    maxWidth: 100,
                                    mx: 1,
                                    color: audioState.speech.styling.textColor,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}
                            >
                                {audioState.speech.speakerName}
                            </Typography>
                            <Box sx={{ display: 'flex', flexGrow: 1, minWidth: 100, maxWidth: 700 }}>
                                <AudioPlayer
                                    source={audioState.speech.source}
                                    textColor={audioState.speech.styling.textColor}
                                    buttonColor={audioState.speech.styling.buttonColor}
                                    visualizationColor={audioState.speech.styling.audioVisualizationColor}
                                    onBrowserBlockedPlayback={() => onBrowserBlockedPlayback('speech')}
                                    playOnLoad={true}
                                    DEBUG_audioType="speech"
                                    onStateChange={(state) => handleAudioPlayerStateChange('speech', state)}
                                    getPlaybackControlRef={(ref) => speechControllerRef.current = ref}
                                    loop={audioState.speech.loop || false}
                                    playbackSpeed={speechPlaybackSpeedToUse}
                                    volume={volumeToUse}
                                    debug={Constants.debug.logAudioPlayback}
                                />
                            </Box>
                        </Box>
                    </Box>
                )}
                
                {audioState.backgroundMusic?.source && (
                        <Box sx={{ 
                            display: 'flex',
                            alignItems: 'center',
                            minWidth: 0,
                            mx: 0
                        }}>
                            <AudioPlayer
                                source={audioState.backgroundMusic.source}
                                textColor={theme.colors.textColor}
                                buttonColor={theme.colors.buttonColor}
                                visualizationColor={theme.colors.visualizationColor}
                                playOnLoad={(!bgMusicMuted)}
                                onBrowserBlockedPlayback={() => onBrowserBlockedPlayback('backgroundMusic')}
                                onStateChange={(state) => handleAudioPlayerStateChange('backgroundMusic', state)}
                                getPlaybackControlRef={(ref) => bgMusicControllerRef.current = ref}
                                DEBUG_audioType="backgroundMusic"
                                loop={audioState.backgroundMusic.loop || false}
                                showControls={false}
                                volume={volumeToUse * 0.2}
                                debug={Constants.debug.logAudioPlayback}
                            />
                        </Box>
                    )}
                
                {audioState.soundEffect?.source && (
                    <Box sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: 0,
                        mx: 0
                    }}>
                        <AudioPlayer
                            source={audioState.soundEffect.source}
                            textColor={theme.colors.textColor}
                            buttonColor={theme.colors.buttonColor}
                            visualizationColor={theme.colors.visualizationColor}
                            playOnLoad={(!soundEffectMuted)}
                            onBrowserBlockedPlayback={() => onBrowserBlockedPlayback('soundEffect')}
                            onStateChange={(state) => handleAudioPlayerStateChange('soundEffect', state)}
                            getPlaybackControlRef={(ref) => soundEffectControllerRef.current = ref}
                            DEBUG_audioType="soundEffect"
                            loop={audioState.soundEffect.loop || false}
                            showControls={false}
                            volume={volumeToUse * 0.2}
                            debug={Constants.debug.logAudioPlayback}
                        />
                    </Box>
                )}
            </Box>
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                minWidth: 40,
                ml: 'auto',
            }}>
                <Tooltip title={bgMusicMuted ? "Unmute background music" : "Mute background music"}>
                    <IconButton 
                        className={classes.buttonStyle} 
                        onClick={() => {
                            (bgMusicMuted) ? unMuteAudio('backgroundMusic') : muteAudio('backgroundMusic');
                            setBgMusicMuted(!bgMusicMuted);
                        }}
                        sx={{ ml: 0.5 }}
                    >
                        {bgMusicMuted ? <VolumeOff /> : <MusicNote />}
                    </IconButton>
                </Tooltip>
                <Tooltip title={soundEffectMuted ? "Unmute sound effects" : "Mute sound effects"}>
                    <IconButton 
                        className={classes.buttonStyle} 
                        onClick={() => {
                            (soundEffectMuted) ? unMuteAudio('soundEffect') : muteAudio('soundEffect');
                            setSoundEffectMuted(!soundEffectMuted);
                        }}
                        sx={{ ml: 0.5 }}
                    >
                        {soundEffectMuted ? <VolumeOff /> : <GraphicEq />}
                    </IconButton>
                </Tooltip><Button
                type="button"
                size="small"
                aria-describedby={'popover'}
                variant="contained"
                onClick={(event) => setAnchorState({ anchor: event.currentTarget, type: 'speed' })}
                sx={{ mx: 0.5, color: theme.colors.textColor, backgroundColor: theme.colors.buttonColor }}
            >
                <Speed />
            </Button>
            <Button
                size="small"
                type="button"
                aria-describedby={'popover'}
                variant="contained"
                onClick={(event) => setAnchorState({ anchor: event.currentTarget, type: 'volume' })}
                sx={{ mx: 0.5, color: theme.colors.textColor, backgroundColor: theme.colors.buttonColor }}
            >
                <VolumeUp />
            </Button>

            <Popover
                id={'popover'}
                open={Boolean(anchorState)}
                anchorEl={anchorState?.anchor}
                onClose={() => setAnchorState(null)}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
            >
                {anchorState?.type === 'speed' && (
                    <Box sx={{ height: 200, width: 80, alignContent: 'center', justifyContent: 'center' }}>
                        <Slider
                            sx={{ height: 150 }}
                            orientation="vertical"
                            value={speechPlaybackSpeed}
                            step={0.25}
                            marks={[
                                { value: 0.5, label: '0.5x' },
                                { value: 0.75, label: '0.75x' },
                                { value: 1, label: '1x' },
                                { value: 1.25, label: '1.25x' },
                                { value: 1.5, label: '1.5x' },
                                { value: 1.75, label: '1.75x' },
                                { value: 2, label: '2x' },
                            ]}
                            min={0.5}
                            max={2}
                            onChange={(e, value) => handleSpeedChange(value)}
                        />
                    </Box>
                )}
                {anchorState?.type === 'volume' && (
                    <Stack spacing={2} direction="column" sx={{ mb: 1 }} alignItems="center">
                        <VolumeDown />
                        <Slider
                            sx={{ height: 200, margin: '0 20px' }}
                            orientation="vertical"
                            step={0.1}
                            min={0}
                            max={1}
                            value={volume}
                            onChange={handleVolumeChange}
                            valueLabelDisplay="auto"
                        />
                        <VolumeUp />
                    </Stack>
                )}
            </Popover>
            </Box>
            <Dialog open={showAudioPermissionDialog} onClose={handleOptOutBackgroundAudio}>
                <DialogTitle>Background Audio Permission</DialogTitle>
                <DialogContent>
                    <Typography>
                        This experience has audio that's been blocked by your web browser. Click "Allow" to enable audio playback.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button variant='outlined' onClick={handleOptOutBackgroundAudio}>Block audio</Button>
                    <Button variant='outlined' onClick={handleAllowBackgroundAudio} autoFocus>Allow</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
});
