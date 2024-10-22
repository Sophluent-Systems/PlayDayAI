import { makeStyles } from 'tss-react/mui';
import { Box, Paper } from '@mui/material';
import { MainDrawer } from './maindrawer';
import { OuterContainer } from './outercontainer';
import { defaultAppTheme } from '@src/common/theme';
import Title from './title';

const useStyles = makeStyles()((theme, { colors, fonts }) => ({
  titleContainer: {
    height: '100%',
    width: '100%',
    backgroundColor: colors.titleBackgroundColor,
  },
  titleTypography: {
    fontSize: '2rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    fontFamily: fonts.titleFont,
    color: colors.titleFontColor,
    textAlign: 'center',
    textShadow: `0px 0px 10px ${theme.palette.text.secondary}`,
    marginBottom: '0',
  },
  paperContainer: {
    width: '100%',
    backgroundColor: colors.titleBackgroundColor,
    display: 'flex',
    justifyContent: 'center', // Center the content
    marginBottom: theme.spacing(10), // Add spacing below the title
    padding: theme.spacing(2),
  },
  titlePaper: {
    backgroundColor: colors.titleBackgroundColor,
    width: '90%', // Use a percentage for responsiveness
    maxWidth: 600, // Set a max width for larger screens
    height: 120,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto',
    marginBottom: 16,
    borderRadius: 8,
    padding: theme.spacing(1),
    boxShadow: theme.shadows[2], // Add a subtle shadow
  },
  contentContainer: {
    width: '80%', // Use a percentage for responsiveness
    maxWidth: 1200, // Set a max width for larger screens
    margin: '0 auto',
    padding: theme.spacing(2), // Add padding for inner content
  },
}));

export function DefaultLayout(props) {
  const {
    children,
    logoBanner,
    title,
    theme,
  } = props;
  const themeToUse = theme ? theme : defaultAppTheme;
  const { classes } = useStyles(themeToUse);

  return (
    <OuterContainer title="Play Day.AI" theme={themeToUse}>
      {logoBanner && (
        <Box className={classes.paperContainer}>
          <Paper elevation={3} className={classes.titlePaper}>
            <img src="/logo_banner_large.png" alt="Logo Banner" style={{ height: '100%' }} />
          </Paper>
        </Box>
      )}
      {title && (
        <Title title={title}   />
      )}
        {children}
      <MainDrawer theme={themeToUse} />
    </OuterContainer>
  );
}
