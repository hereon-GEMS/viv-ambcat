import React, { useEffect } from "react";

import Controller from "./components/Controller";
import DropzoneWrapper from "./components/DropzoneWrapper";
import Footer from "./components/Footer";
import SnackBars from "./components/Snackbars";
import Viewer from "./components/Viewer";
import { useImage } from "./hooks";
import { useViewerStore, useGUIStore, GUI_LIBRARY } from "./state";
import { Grid } from "@mui/material";

import "./index.css";

/**
 * This component serves as batteries-included visualization for OME-compliant tiff or zarr images.
 * This includes color contrastLimits, selectors, and more.
 * @param {Object} props
 * @param {Object} props.history A React router history object to create new urls (optional).
 * @param {Object} args.sources A list of sources for a dropdown menu, like [{ url, description }]
 * */
export default function Ambivator(props) {
  const { source: initSource, isDemoImage } = props;
  const isViewerLoading = useViewerStore((store) => store.isViewerLoading);
  const source = useViewerStore((store) => store.source);
  const useLinkedView = useViewerStore((store) => store.useLinkedView);
  const { defaultGUI } = useGUIStore(); // Access Zustand store, change default in state.js

  // biome-ignore lint/correctness/useExhaustiveDependencies: Ignore carried over from eslint, without explanation.
  useEffect(() => {
    useViewerStore.setState({
      source: initSource,
      isVolumeRenderingWarningOn: false, // Disable volume rendering warning for ambivator
      //isNoImageUrlSnackbarOn: isDemoImage,
      isNoImageUrlSnackbarOn: false, // Disable no image url snackbar for ambivator
    });
  }, []);
  useImage(source);
  if (defaultGUI == GUI_LIBRARY.DAISYUI) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Controller (Half-width on sm+ screens) */}
        <div>{/*    <Controller /> */}</div>

        {/* Dropzone + Viewer (Full-width) */}
        <div className="col-span-1 sm:col-span-2">
          <DropzoneWrapper>{!isViewerLoading && <Viewer />}</DropzoneWrapper>
        </div>

        {/* SnackBars (Half-width on sm+ screens) */}
        <div>{/*   <SnackBars /> */}</div>

        {/* Conditional Footer (Full-width) */}
        {!useLinkedView && (
          <div className="col-span-1 sm:col-span-2">{/*    <Footer /> */}</div>
        )}
      </div>
    );
  } else if (defaultGUI == GUI_LIBRARY.MUI) {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Controller />
        </Grid>
        <Grid item xs={12}>
          <DropzoneWrapper>{!isViewerLoading && <Viewer />}</DropzoneWrapper>
        </Grid>

        <Grid item xs={12} sm={6}>
          <SnackBars />
        </Grid>

        {!useLinkedView && (
          <Grid item xs={12}>
            <Footer />
          </Grid>
        )}
      </Grid>
    );
  } else {
    return <div>Unknown GUI_LIBRARY setting</div>;
  }
}
