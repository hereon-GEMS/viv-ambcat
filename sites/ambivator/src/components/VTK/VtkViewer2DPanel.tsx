import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from "react";

//import _ from "lodash";

declare global {
  interface Window {
    HSRangeSlider?: any;
    _?: any;
  }
}

export interface VtkViewer2DPanelProps {
  toggleInputId: string; // ID of the associated drawer toggle input
  frameCount?: number;
  initialFrameIndex?: number;
  onFrameIndexUpdate?: (value: number) => void;
  debug?: boolean;
}

export interface VtkViewer2DPanelHandle {
  focusZSlider: () => void;
}

const VtkViewer2DPanel = forwardRef<
  VtkViewer2DPanelHandle | HTMLDivElement,
  VtkViewer2DPanelProps
>(
  (
    {
      toggleInputId,
      frameCount = 0,
      initialFrameIndex = 0,
      onFrameIndexUpdate: onFrameIndexUpdate = null,
      debug = false,
    },
    forwardedRef,
  ) => {
    const rootDivRef = useRef<HTMLDivElement | null>(null);
    const sliderDivRef = useRef<HTMLDivElement | null>(null);
    const textInputRef = useRef<HTMLInputElement | null>(null);
    const sliderInstanceRef = useRef<any>(null);

    const [frameIndex, setFrameIndex] = useState<number>(
      initialFrameIndex ?? 0,
    );
    useEffect(() => {
      if (initialFrameIndex !== frameIndex) {
        setFrameIndex(initialFrameIndex);
      }
    }, [initialFrameIndex]);

    const clamp = useCallback(
      (v: number) => {
        if (frameCount <= 0) return 0;
        if (v < 0) return 0;
        if (v > frameCount - 1) return frameCount - 1;
        return v;
      },
      [frameCount],
    );

    // Initialize or update Preline slider
    useEffect(() => {
      const HSRangeSlider = window.HSRangeSlider;
      if (!HSRangeSlider) {
        console.warn(
          "HSRangeSlider not found. Ensure Preline script is loaded.",
        );
        return;
      }
      const rangeElement = sliderDivRef.current;
      const targetInput = textInputRef.current;

      if (!rangeElement) {
        console.warn("Slider div ref is null");
        return;
      }
      if (!targetInput) {
        console.warn("Text input ref is null");
        return;
      }

      // Destroy existing instance if it exists
      if (sliderInstanceRef.current) {
        sliderInstanceRef.current.destroy();
        sliderInstanceRef.current = null;
      }

      // Initialize new slider instance
      const getRoundedStep = (range: number): number => {
        if (range <= 10) return 1;
        // Step calculated based on the range divided by 10
        let step = range / 10 + 1;

        // Calculate the order of magnitude (e.g., 100 for 99, 1000 for 399)
        const magnitude = 10 * Math.pow(10, Math.floor(Math.log10(step)));

        // Choose the nearest increment: either 10^n or 10^n/2
        if (step < magnitude / 2) {
          return magnitude / 2;
        } else {
          return magnitude;
        }
      };

      const generatePipsValues = (min: number, max: number): number[] => {
        // Calculate the total range
        const range = max - min;

        // Get the rounded step
        const step = getRoundedStep(range);

        // Generate pips values by incrementing from min to max
        const values: number[] = [];

        // Add values in increments of `step`
        for (let i = min; i <= max; i += step) {
          values.push(i);
        }

        // Check if the last pip is too close to `max`
        const lastValue = values[values.length - 1];
        const distanceToMax = max - lastValue;

        // If the last pip is within 20% of the step away from max, don't include max
        if (distanceToMax <= step / 5) {
          values.pop(); // Remove the last pip (max)
        }

        // Push the max value if it's not too close
        values.push(max);

        return values;
      };

      // Build JSON config string dynamically
      const configObj = {
        start: clamp(frameIndex),
        connect: "lower",
        range: { min: 0, max: Math.max(frameCount - 1, 0) },
        tooltips: true,
        formatter: "integer",
        cssClasses: {
          target:
            "relative h-2 rounded-full bg-gray-300 dark:bg-neutral-700 w-full",
          base: "size-full relative z-1",
          origin: "absolute top-0 end-0 size-full origin-[0_0] rounded-full",
          handle:
            "absolute top-1/2 end-0 size-4.5 bg-white border-4 border-blue-600 rounded-full cursor-pointer translate-x-2/4 -translate-y-2/4 dark:border-blue-500",
          connects: "relative z-0 size-full rounded-full overflow-hidden",
          connect:
            "absolute top-0 end-0 z-1 size-full bg-blue-600 origin-[0_0] dark:bg-blue-500",
          touchArea: "absolute -inset-1",
          tooltip:
            "bg-white border border-gray-300 text-sm text-gray-800 py-1 px-2 rounded-lg mb-3 absolute bottom-full start-2/4 -translate-x-2/4 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white",
          pips: "relative w-full h-10 mt-1",
          value:
            "absolute top-4 -translate-x-2/4 text-sm text-gray-400 dark:text-neutral-500",
          marker:
            "absolute h-4 border-s border-gray-400 dark:border-neutral-500",
        },
        pips: {
          mode: "values",
          values: generatePipsValues(0, Math.max(frameCount - 1, 0)), // Dynamically generate pips
          density: 500,
        },
      };
      // Keep data attribute updated (Preline reads at init)
      rangeElement.setAttribute(
        "data-hs-range-slider",
        JSON.stringify(configObj),
      );
      const rangeInstance = new HSRangeSlider(rangeElement);
      sliderInstanceRef.current = rangeInstance;

      // Add 'update' event listener to sync slider with the text input
      rangeElement.noUiSlider.on("update", (values: string[]) => {
        // Update text input value when the slider is updated
        targetInput.value = rangeInstance.formattedValue;
        if (onFrameIndexUpdate) {
          //onFrameIndexUpdate(parseInt(values[0], 10)); // You can call your callback here
          onFrameIndexUpdate(parseInt(rangeInstance.formattedValue, 10));
        }
      });

      let debounceMouseWheel: number | null = null;

      rangeElement.addEventListener("wheel", (event) => {
        if (debounceMouseWheel !== null) return; // already debouncing
        if (!event.shiftKey) return; // only when shift is pressed
        event.preventDefault(); // prevent page scroll
        const step = 1; // adjust how much the slider changes per wheel tick
        let currentValue = parseInt(rangeInstance.formattedValue, 10);
        // Wheel delta: positive = scroll up, negative = scroll down
        console.log(
          `Wheel event with deltaY=${event.deltaY}, currentValue=${currentValue}, step=${step}`,
        );
        currentValue += event.deltaY < 0 ? step : -step;
        currentValue = clamp(currentValue);
        // debounce the slider update
        if (debounceMouseWheel !== null) clearTimeout(debounceMouseWheel);
        debounceMouseWheel = window.setTimeout(() => {
          rangeInstance.el.noUiSlider.set(currentValue);
          debounceMouseWheel = null;
        }, 50); // 50ms delay (adjust if needed)
      });

      // Debounced input event listener for syncing the slider value with input field
      const debouncedSliderUpdate = _.debounce((evt: Event) => {
        const value = (evt.target as HTMLInputElement).value;
        rangeInstance.el.noUiSlider.set(value);
      }, 200);

      targetInput.addEventListener("input", debouncedSliderUpdate);

      // Cleanup function to remove event listeners on unmount
      return () => {
        targetInput.removeEventListener("input", debouncedSliderUpdate);
      };
    }, [frameCount, frameIndex, clamp, onFrameIndexUpdate]);

    useImperativeHandle(
      forwardedRef,
      () => ({
        focusZSlider: () => {
          textInputRef.current?.focus();
        },
      }),
      [],
    );

    return (
      <div
        className="drawer-side is-drawer-close:overflow-visible w-full"
        ref={rootDivRef}
        style={{ border: debug ? "2px dashed magenta" : undefined }}
      >
        <label
          htmlFor={toggleInputId}
          aria-label="close sidebar"
          className="drawer-overlay"
        ></label>
        <div className="is-drawer-close:w-14 is-drawer-open:w-128 bg-gray-100 flex flex-col items-start min-h-full w-full">
          <ul className="menu w-full grow">
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
                <span className="is-drawer-close:hidden">Home</span>
              </button>
            </li>
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
            <li className="w-full is-drawer-close:hidden">
              <div className="border border-gray-300 bg-gray-100 rounded-xl shadow-2xs pt-15 p-6 flex w-full flex-col justify-start dynamicPreline">
                {/* Descriptive Label inside the border */}
                <div className="absolute top-0 left-0 translate-x-1 -translate-y-3 bg-gray-100 text-sm font-normal text-gray-600 px-2 py-1 rounded-tl-xl rounded-br-xl">
                  Set frame (dimz = {frameCount}).
                </div>
                <div className="flex items-center justify-between"></div>

                {/* Injected Preline slider markup */}
                <label className="sr-only">Z slice</label>
                {
                  <div
                    id="hs-pass-value-to-input"
                    ref={sliderDivRef}
                    className="--prevent-on-load-init"
                  ></div>
                }
                <div className="mt-10 grid grid-flow-col w-full justify-start items-center gap-4">
                  <div className="mt-0 max-w-20 border border-gray-300 rounded-xl">
                    <input
                      id="hs-pass-value-to-input-target"
                      ref={textInputRef}
                      className="py-2.5 sm:py-3 px-2 block w-full border-gray-700 rounded-lg sm:text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
                      type="text"
                      defaultValue={frameIndex}
                    />
                  </div>
                  <div className="w-full">
                    Shift + Wheel for fine slider adjustment.
                  </div>
                </div>
              </div>
            </li>
          </ul>

          <div
            className="m-2 is-drawer-close:tooltip is-drawer-close:tooltip-right"
            data-tip="Open"
          >
            <label
              htmlFor={toggleInputId}
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
    );
  },
);

VtkViewer2DPanel.displayName = "VtkViewer2DPanel";

export default React.memo(VtkViewer2DPanel);
