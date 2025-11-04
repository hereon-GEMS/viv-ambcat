// src/App.tsx
import { useLayoutEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useGUIStore, GUI_LIBRARY } from "./state";
import Ambivator from "./Ambivator";
import { getNameFromUrl } from "./utils";

// Lazy import Preline
async function loadPreline() {
  return import("preline/dist/index.js");
}

/**
 * Describes the structure of a resolved image source.
 */
export interface ResolvedSource {
  urlOrFile: string | null;
  description: string;
  isDemoImage: boolean;
}

/**
 * Resolves a source object from a given URL, or optionally returns a random demo image.
 *
 * @param url - The image URL (may be null).
 * @param provideDemoImage - Whether to provide a random demo image when no URL is given.
 * @returns A strongly typed source object.
 */
export function resolveSource(
  url: string | null,
  provideDemoImage: boolean = false,
): ResolvedSource {
  if (url) {
    return {
      urlOrFile: url,
      description: getNameFromUrl(url),
      isDemoImage: false,
    };
  }

  if (provideDemoImage && sources.length > 0) {
    const random = sources[Math.floor(Math.random() * sources.length)];
    return {
      ...random,
      isDemoImage: true,
    };
  }

  return {
    urlOrFile: null,
    description: "No image specified",
    isDemoImage: false,
  };
}

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams(); // React Router hook to get URL search params
  const location = useLocation();
  const { defaultGUI } = useGUIStore();

  // Preline re-init on route change
  useLayoutEffect(() => {
    const initPreline = async () => {
      await loadPreline();
      window.HSStaticMethods?.autoInit();
    };

    // Observe for any new dynamicPreline elements added to the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (
              node.classList.contains("dynamicPreline") ||
              node.querySelector(".dynamicPreline")
            ) {
              window.HSStaticMethods?.autoInit();
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    initPreline();
  }, [location.pathname]);

  // Get ?image_url= param
  const imageUrl = searchParams.get("image_url");
  const source = resolveSource(imageUrl);
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
  }
}
