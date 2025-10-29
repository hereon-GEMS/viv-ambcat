import React, { useEffect } from "react";
//import { grey } from "@mui/material/colors";
// import {
//   StyledEngineProvider,
//   ThemeProvider,
//   adaptV4Theme,
//   createTheme,
// } from "@mui/material/styles";
import ReactDOM from "react-dom/client";
import Ambivator from "./Ambivator";
import sources from "./source-info";
import { getNameFromUrl } from "./utils";
import { useGUIStore, GUI_LIBRARY } from "./state";

// const theme = createTheme({
//   palette: {
//     mode: "dark",
//     primary: grey,
//     secondary: grey,
//   },
//   props: {
//     MuiButtonBase: {
//       disableRipple: true,
//     },
//   },
// });

import "./index.css";

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

    //tailwind test
    //     return (
    //   <div className="h-screen w-screen flex flex-col items-center justify-center gap-6 p-4 bg-gray-50">

    //     {/* Tailwind styled content */}
    //     <div className="p-4 bg-gray-200 rounded shadow-md w-full max-w-md text-center">
    //       <h1 className="text-2xl font-bold text-blue-600 mb-2">Tailwind works!</h1>
    //       <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
    //         Tailwind Button
    //       </button>
    //     </div>

    //     {/* DaisyUI styled content */}
    //     <div className="p-4 bg-gray-100 rounded shadow-md w-full max-w-md text-center">
    //       <h1 className="text-2xl font-bold text-purple-600 mb-2">DaisyUI works!</h1>
    //       <button className="btn btn-primary mr-2">Primary Button</button>
    //       <button className="btn btn-secondary">Secondary Button</button>
    //     </div>
    //   </div>
    // );
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
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
