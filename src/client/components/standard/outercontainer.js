"use client";

import { useEffect } from "react";
import { Box } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { useAtom } from "jotai";
import { vhState } from "@src/client/states";

const useStyles = makeStyles()((theme) => ({
  container: {
    justifyContent: "flex-start",
    alignItems: "center",
    backgroundColor: theme.palette.background.immersive,
  },
}));

export function OuterContainer(props) {
  const { classes } = useStyles();
  const { children, title } = props;
  const [, setVh] = useAtom(vhState);

  useEffect(() => {
    const setViewportHeight = () => setVh(window.innerHeight);

    window.addEventListener("resize", setViewportHeight);
    setViewportHeight();

    return () => window.removeEventListener("resize", setViewportHeight);
  }, [setVh]);

  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  return (
    <main>
      <Box className={classes.container}>{children}</Box>
    </main>
  );
}
