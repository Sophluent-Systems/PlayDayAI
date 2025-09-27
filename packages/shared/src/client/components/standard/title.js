import React from 'react';
import { Typography, Box } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { defaultAppTheme } from '@src/common/theme';

const useStyles = makeStyles()((theme, pageTheme) => {
    const {
      colors,
      fonts,
    } = pageTheme;
    return ({
      titleContainer: {
        height: '75px',
        width: '100%',
        alignContent: 'center',
        backgroundColor: colors.titleBackgroundColor,
      },
      titleTypography: {
        fontSize: '2em',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        fontFamily: fonts.titleFont,
        color: colors.titleFontColor,
        textAlign: 'center',
        textShadow: `0px 0px 10px ${theme.palette.text.secondary}`,
        marginBottom: '0',
        marginTop: '0',
      },
    });
  });
  


function Title(props) {
    const { title, theme } = props;
    const themeToUse = theme || defaultAppTheme;
    const { classes } = useStyles(themeToUse);

    return (
      <Box className={classes.titleContainer}>
          <Typography variant="h4" className={classes.titleTypography}>
            {title}
          </Typography>
      </Box>
    );
}

export default Title;