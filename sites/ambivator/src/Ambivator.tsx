import React, { useEffect } from "react";

//import Controller from "./components/Controller";
import DropzoneWrapper from "./components/DropzoneWrapper";
//import Footer from "./components/Footer";
//import SnackBars from "./components/Snackbars";
import Viewer from "./components/Viewer";
import { useImage } from "./hooks";
import { useViewerStore, useGUIStore, GUI_LIBRARY } from "./state";
//import { Grid } from "@mui/material";

import noUiSlider from "nouislider";
//import 'nouislider/dist/nouislider.css';
/**
 * This component serves as batteries-included visualization for OME-compliant tiff or zarr images.
 * This includes color contrastLimits, selectors, and more.
 * @param {Object} props
 * @param {Object} props.history A React router history object to create new urls (optional).
 * @param {Object} args.sources A list of sources for a dropdown menu, like [{ url, description }]
 * */
export default function Ambivator(props) {
  try {
    const { source: initSource, isDemoImage } = props;
    const isViewerLoading = useViewerStore((store) => store.isViewerLoading);
    const source = useViewerStore((store) => store.source);
    const useLinkedView = useViewerStore((store) => store.useLinkedView);
    const { defaultGUI, debugGUI } = useGUIStore(); // Access Zustand store, change default in state.js

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
      console.log("Rendering Ambivator with isViewerLoading:", isViewerLoading);
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full h-full flex-1 flex-col">
          {/* Controller (Half-width on sm+ screens) */}
          {/*<div>    <Controller /> </div>*/}

          {/* Dropzone + Viewer (Full-width) */}
          <div className="col-span-1 sm:col-span-2 flex-1 flex-col h-full">
            <DropzoneWrapper>
              {!isViewerLoading && <Viewer debug={debugGUI} />}
              {/* <Viewer debug={debugGUI} /> */}
            </DropzoneWrapper>
          </div>

          {/* SnackBars (Half-width on sm+ screens) */}
          {/*<div>   <SnackBars /> </div>*/}

          {/* Conditional Footer (Full-width) */}
          {/*!useLinkedView && (
          <div className="col-span-1 sm:col-span-2">{    <Footer /> }</div>
        )*/}
        </div>
      );
      const baseDivRef = null;
      const debug = false;
      return (
        <div
          ref={baseDivRef}
          className="flex-1 h-full w-full"
          style={{
            border: debug ? "5px solid red" : "none",
          }}
        >
          <div className="drawer drawer-open drawer-end">
            <input
              id="my-drawer-4"
              type="checkbox"
              className="drawer-toggle"
              defaultChecked="true"
            />
            <div className="drawer-content">{/* Page content here */}</div>

            <div className="drawer-side is-drawer-close:overflow-visible">
              <label
                htmlFor="my-drawer-4"
                aria-label="close sidebar"
                className="drawer-overlay"
              ></label>
              <div className="is-drawer-close:w-14 is-drawer-open:w-64 bg-gray-100 flex flex-col items-start min-h-full">
                {/* Sidebar content here */}
                <ul className="menu w-full grow">
                  {/* list item */}
                  <li>
                    <button
                      className="is-drawer-close:tooltip is-drawer-close:tooltip-right"
                      data-tip="Homepage"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeWidth="2"
                        fill="none"
                        stroke="currentColor"
                        className="inline-block size-4 my-1.5"
                      >
                        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path>
                        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      </svg>
                      <span className="is-drawer-close:hidden">Homepage</span>
                    </button>
                  </li>

                  {/* list item */}
                  <li>
                    <button
                      className="is-drawer-close:tooltip is-drawer-close:tooltip-right"
                      data-tip="Settings"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeWidth="2"
                        fill="none"
                        stroke="currentColor"
                        className="inline-block size-4 my-1.5"
                      >
                        <path d="M20 7h-9"></path>
                        <path d="M14 17H5"></path>
                        <circle cx="17" cy="17" r="3"></circle>
                        <circle cx="7" cy="7" r="3"></circle>
                      </svg>
                      <span className="is-drawer-close:hidden">Settings</span>
                    </button>
                  </li>
                  <div
                    style={{
                      border: "5px solid blue", // Blue border
                      padding: "20px", // Padding inside the container
                      width: "100%", // Ensure the container spans full width
                      height: "auto", // Adjust height based on content
                      boxSizing: "border-box", // Ensure padding is included in the total width/height
                    }}
                    className="is-drawer-close:hidden dynamicPreline"
                  >
                    <label className="sr-only">Example range</label>
                    <div
                      data-hs-range-slider='{
  "start": 50,
  "connect": "lower",
  "range": {
    "min": 0,
    "max": 100
  },
  "cssClasses": {
    "target": "relative h-2 rounded-full bg-gray-100 dark:bg-neutral-700",
    "base": "size-full relative z-1",
    "origin": "absolute top-0 end-0 size-full origin-[0_0] rounded-full",
    "handle": "absolute top-1/2 end-0 size-4.5 bg-white border-4 border-blue-600 rounded-full cursor-pointer translate-x-2/4 -translate-y-2/4 dark:border-blue-500",
    "connects": "relative z-0 size-full rounded-full overflow-hidden",
    "connect": "absolute top-0 end-0 z-1 size-full bg-blue-600 origin-[0_0] dark:bg-blue-500",
    "touchArea": "absolute -inset-1"
  }
}'
                    ></div>
                  </div>
                </ul>

                {/* button to open/close drawer */}
                <div
                  className="m-2 is-drawer-close:tooltip is-drawer-close:tooltip-right"
                  data-tip="Open"
                >
                  <label
                    htmlFor="my-drawer-4"
                    className="btn btn-ghost btn-circle drawer-button is-drawer-open:rotate-y-180"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeWidth="2"
                      fill="none"
                      stroke="currentColor"
                      className="inline-block size-4 my-1.5"
                    >
                      <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path>
                      <path d="M9 4v16"></path>
                      <path d="M14 10l2 2l-2 2"></path>
                    </svg>
                  </label>
                </div>
              </div>
            </div>
          </div>
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
  } catch (error) {
    return <div>Error in Ambivator component: {error.message}</div>;
  }
}
