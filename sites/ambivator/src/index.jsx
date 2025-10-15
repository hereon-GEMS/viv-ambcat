import React, { useEffect } from "react";
import { grey } from "@mui/material/colors";
import {
  StyledEngineProvider,
  ThemeProvider,
  adaptV4Theme,
  createTheme,
} from "@mui/material/styles";
import ReactDOM from "react-dom/client";
import Ambivator from "./Ambivator";
import sources from "./source-info";
import { getNameFromUrl } from "./utils";
import { useGUIStore, GUI_LIBRARY } from "./state";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: grey,
    secondary: grey,
  },
  props: {
    MuiButtonBase: {
      disableRipple: true,
    },
  },
});

/** @param {string | null} url */
function resolveSource(url) {
  if (url) {
    return {
      urlOrFile: url,
      description: getNameFromUrl(url),
      isDemoImage: false,
    };
  }
  // Pick a random source if none is specified.
  /*
  return {
    ...sources[Math.floor(Math.random() * sources.length)],
    isDemoImage: true
  };*/
  return {
    urlOrFile: null,
    description: "No image specified",
    isDemoImage: false,
  };
}

function App() {
  const { defaultGUI } = useGUIStore(); // Access Zustand store, change default in state.js
  const query = new URLSearchParams(window.location.search);
  const source = resolveSource(query.get("image_url"));

  console.log("Current defaultGUI:", defaultGUI); // Check the current state of defaultGUI
  if (defaultGUI == GUI_LIBRARY.MUI) {
    return (
      <StyledEngineProvider injectFirst>
        (
        <ThemeProvider theme={theme}>
          <Ambivator source={source} isDemoImage={source.isDemoImage} />
        </ThemeProvider>
        )
      </StyledEngineProvider>
    );
  } else {
    return <Ambivator source={source} isDemoImage={source.isDemoImage} />;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
