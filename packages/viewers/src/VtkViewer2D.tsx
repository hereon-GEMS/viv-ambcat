import React, { useEffect, useRef, useState } from "react";

// Logic inspired by https://kitware.github.io/vtk-js/examples/PaintWidget.html

import "@kitware/vtk.js/Rendering/Profiles/All";

import vtkImageData from "@kitware/vtk.js/Common/DataModel/ImageData";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkFullScreenRenderWindow from "@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow";
import vtkWidgetManager from "@kitware/vtk.js/Widgets/Core/WidgetManager";
import vtkInteractorStyleImage from "@kitware/vtk.js/Interaction/Style/InteractorStyleImage";
import vtkImageMapper from "@kitware/vtk.js/Rendering/Core/ImageMapper";
import vtkImageSlice from "@kitware/vtk.js/Rendering/Core/ImageSlice";
import vtkPaintFilter from "@kitware/vtk.js/Filters/General/PaintFilter";
import vtkColorTransferFunction from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction";
import vtkPiecewiseFunction from "@kitware/vtk.js/Common/DataModel/PiecewiseFunction";
import vtkCubeSource from "@kitware/vtk.js/Filters/Sources/CubeSource";
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";
import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";

//Orientation widget
import vtkOrientationMarkerWidget from "@kitware/vtk.js/Interaction/Widgets/OrientationMarkerWidget";
import vtkAxesActor from "@kitware/vtk.js/Rendering/Core/AxesActor";

//CTF widget
import vtkPiecewiseGaussianWidget from "@kitware/vtk.js/Interaction/Widgets/PiecewiseGaussianWidget";

//Reader with compression
import vtkHttpDataSetReader from "@kitware/vtk.js/IO/Core/HttpDataSetReader";
//import vtkDataAccessHelper from '@kitware/vtk.js/IO/Core/DataAccessHelper';
import "@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper";
//import '@kitware/vtk.js/IO/Core/DataAccessHelper/JSZipDataAccessHelper';

import {
  BehaviorCategory,
  ShapeBehavior,
} from "@kitware/vtk.js/Widgets/Widgets3D/ShapeWidget/Constants";

import { ViewTypes } from "@kitware/vtk.js/Widgets/Core/WidgetManager/Constants";

//import './style.css';

//Helper function https://kitware.github.io/vtk-js/examples/PaintWidget.html
function setCamera(sliceMode, renderer, data) {
  const ijk = [0, 0, 0];
  const position = [0, 0, 0];
  const focalPoint = [0, 0, 0];
  data.indexToWorld(ijk, focalPoint);
  ijk[sliceMode] = 1;
  data.indexToWorld(ijk, position);
  renderer.getActiveCamera().set({ focalPoint, position });
  renderer.resetCamera();
}

// Restrict to valid TypedArray types
type NumericTypedArray =
  | Uint8Array
  | Uint16Array
  | Int16Array
  | Float32Array
  | Float64Array;

// Define the expected input shape
interface PixelSource {
  width: number;
  height: number;
  data: NumericTypedArray;
}

//Converting raw array to vtkImageData object
export function pixelSourceToVtkImageData({
  width,
  height,
  data,
}: PixelSource): VtkImageData {
  //Type required to build vtkImageData, which might be visualized by vtk.js pipeline
  const scalars = vtkDataArray.newInstance({
    name: "Scalars", // Required
    numberOfComponents: 1, // Grayscale = 1, RGB = 3, etc.
    values: data, // Must be TypedArray (Uint8Array, Float32Array, etc.)
  });
  //Image of VTK
  const imageData = vtkImageData.newInstance();
  imageData.setDimensions(width, height, 1);
  imageData.getPointData().setScalars(scalars);

  return imageData;
}

interface VtkViewer2DProps {
  loader?: unknown; // adjust this based on your actual loader type
  selection?: unknown;
  width?: number;
  height?: number;
  zoomLock?: boolean;
  panLock?: boolean;
  debug?: boolean;
  controlPanelVisible?: boolean;
  controlPanelSide?: "left" | "right";
}

export default function VtkViewer2D({
  loader,
  selection,
  width = 1024,
  height = 512,
  zoomLock = true,
  panLock = true,
  debug = false,
  controlPanelVisible = false, // default prop
  controlPanelSide = "left", // default prop
}: VtkViewer2DProps) {
  const baseDivRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);
  // Control panel setup
  const [controlPanelVisibleState, setControlPanelVisible] =
    useState(controlPanelVisible);
  const [controlPanelSideState, setControlPanelSide] = useState<
    "left" | "right"
  >(controlPanelSide);

  const [controlPanelWidth, setControlPanelWidth] = useState(300); // initial width
  const [isResizing, setIsResizing] = useState(false);
  const resizerRef = useRef();

  const startResize = () => setIsResizing(true);

  const stopResize = () => setIsResizing(false);

  const onMouseMove = (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX; // For left panel, measure from left
    if (newWidth > 50 && newWidth < 400) setControlPanelWidth(newWidth);
  };

  const vtkObjectsRef = useRef({
    renderWindow: null,
    openGLRenderWindow: null,
    interactor: null,
    renderer: null,
    actor: null,
    mapper: null,
    painter: null,
    colorTransferFunction: null,
    piecewiseFunction: null,
    iStyle: null,
  });

  // top-level refs that live through re-renders
  const sceneRef = useRef(null);
  const ctfRef = useRef(null);
  const pfRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    //return;
    // Ensure viewRef.current is not null
    if (!viewRef.current) {
      console.error("viewRef.current is null");
      return;
    }
    const setupView = (
      viewContainer: HTMLElement,
      vtk_imageData: vtkImageData,
    ) => {
      //Basic info
      const imageScalars = vtk_imageData.getPointData().getScalars();
      const imageData = imageScalars.getData();
      const imageRange = imageScalars.getRange();

      // ----------------------------------------------------------------------------
      // Standard rendering code setup
      // ----------------------------------------------------------------------------
      if (!sceneRef.current) {
        sceneRef.current = {};
        const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
          rootContainer: viewContainer,
          background: [0.1, 0.1, 0.1],
        });
        //Set up renderer
        const renderer = fullScreenRenderer.getRenderer();
        const renderWindow = fullScreenRenderer.getRenderWindow();
        const camera = renderer.getActiveCamera();

        // setup 2D view
        camera.setParallelProjection(true);
        const iStyle = vtkInteractorStyleImage.newInstance();
        iStyle.setInteractionMode("IMAGE_SLICING");
        renderWindow.getInteractor().setInteractorStyle(iStyle);
        sceneRef.current = {
          fullScreenRenderer,
          renderer,
          renderWindow,
          camera,
          iStyle,
          // Add an "image" sub-structure for all image-related pipeline elements
          image: {
            mapper: vtkImageMapper.newInstance(),
            actor: vtkImageSlice.newInstance(),
            ctf: vtkColorTransferFunction.newInstance(),
            pf: vtkPiecewiseFunction.newInstance(),
            ctfWidget: null, // will hold vtkPiecewiseGaussianWidget later
          },
        };
        //Connect mapper actor and renderer
        sceneRef.current.image.actor.setMapper(sceneRef.current.image.mapper);
        sceneRef.current.renderer.addActor(sceneRef.current.image.actor);

        //CTF setup
        sceneRef.current.image.mapper.setInputData(vtk_imageData);
        sceneRef.current.image.ctf.addRGBPoint(imageRange[0], 0.0, 0.0, 0.0);
        sceneRef.current.image.ctf.addRGBPoint(imageRange[1], 1.0, 1.0, 1.0);
        sceneRef.current.image.pf.addPoint(imageRange[0], 1.0);
        sceneRef.current.image.pf.addPoint(imageRange[1], 1.0);
        const imageProp = sceneRef.current.image.actor.getProperty();
        imageProp.setRGBTransferFunction(0, sceneRef.current.image.ctf);
        imageProp.setScalarOpacity(0, sceneRef.current.image.pf);
        imageProp.setUseLookupTableScalarRange(true);

        //CTF widget placement
        const widget = vtkPiecewiseGaussianWidget.newInstance({
          numberOfBins: 256,
          size: [400, 150],
        });
        const widgetContainer = document.createElement("div");
        widgetContainer.style.position = "absolute";
        widgetContainer.style.top = "10px";
        widgetContainer.style.left = "10px";
        widgetContainer.style.background = "rgba(255, 255, 255, 0.8)";
        viewContainer.appendChild(widgetContainer);
        //document.body.appendChild(widgetContainer);
        //widget.applyOpacity(sceneRef.current.image.ctf);
        widget.setContainer(widgetContainer);
        widget.setColorTransferFunction(sceneRef.current.image.ctf);
        widget.bindMouseListeners();
        console.log(imageData);
        // widget.setDataArray(imageData, {
        //   min: imageRange[0],
        //   max: imageRange[1],
        // });
        widget.setDataArray(imageData);
        widget.onOpacityChange(() => {
          //widget.setColorTransferFunction(sceneRef.current.image.ctf);
          //widget.applyOpacity(sceneRef.current.image.ctf);
          sceneRef.current.renderWindow.render();
        });
        sceneRef.current.image.ctfWidget = widget;
      }

      //Get scene and image objects
      const scene = sceneRef.current;
      const image = scene.image;

      // default slice orientation/mode and camera view
      const sliceMode = vtkImageMapper.SlicingMode.K;
      scene.image.mapper.setSlicingMode(sliceMode);
      scene.image.mapper.setSlice(0);
      scene.image.mapper.update();

      // set 2D camera position
      setCamera(sliceMode, scene.renderer, vtk_imageData);

      //Add orientation widget
      const axes = vtkAxesActor.newInstance();
      const orientationWidget = vtkOrientationMarkerWidget.newInstance({
        actor: axes,
        interactor: scene.renderWindow.getInteractor(),
      });
      orientationWidget.setEnabled(true);
      orientationWidget.setViewportCorner(
        vtkOrientationMarkerWidget.Corners.BOTTOM_LEFT,
      );
      orientationWidget.setViewportSize(0.15);
      orientationWidget.setMinPixelSize(100);
      orientationWidget.setMaxPixelSize(300);

      // Render scene
      scene.renderWindow.render();
    };

    const init = async () => {
      console.log("loader:", loader);
      console.log("selection:", selection);
      const raster = await (
        Array.isArray(loader) ? loader[0] : loader
      ).getRaster({ selection: selection || { z: 0 } });
      const vtkImage = pixelSourceToVtkImageData(raster);
      setupView(viewRef.current, vtkImage);
    };

    //Initialize and draw image
    init();

    // Cleanup function to avoid setting state after unmount
    return () => {};
  }, [viewRef]);

  //  return (
  //   <div
  //     className="flex-1 h-full w-full"
  //     style={{
  //       border: debug ? "5px solid red" : "none",
  //     }}
  //   >
  //     <div className="flex h-full w-full overflow-hidden relative">
  //       {/* Left Side Panel */}
  //       {controlPanelVisibleState && controlPanelSideState === "left" && (
  //         <div className="w-64 bg-gray-100 p-4 flex-shrink-0 min-h-full border-r border-gray-300">
  //           LEFT CONTROLS
  //         </div>
  //       )}

  //       {/* Main Viewer Area */}
  //       <div className="flex-1 bg-base-100 flex justify-center items-center h-full">
  //         <div ref={viewRef} />
  //       </div>

  //       {/* Right Side Panel */}
  //       {controlPanelVisibleState && controlPanelSideState === "right" && (
  //         <div className="w-64 bg-gray-100 p-4 flex-shrink-0 min-h-full border-l border-gray-300">
  //           RIGHT CONTROLS
  //         </div>
  //       )}

  //       {/* Toggle button */}
  //       <button
  //         className={`absolute top-2 ${
  //           controlPanelSideState === "right" ? "right-2" : "left-2"
  //         } btn btn-sm btn-primary z-50`}
  //         onClick={() => setControlPanelVisible((prev) => !prev)}
  //       >
  //         {controlPanelVisibleState ? "Hide Controls" : "Show Controls"}
  //       </button>

  //       {/* Demo Content */}
  //       {/* <div className="p-4 bg-gray-200 absolute bottom-4 left-1/2 transform -translate-x-1/2 rounded shadow">
  //         <h1 className="text-2xl font-bold text-blue-600">Tailwind works!</h1>
  //         <button className="px-4 py-2 bg-green-500 text-white rounded mt-2">
  //           Click Me
  //         </button>
  //       </div> */}
  //     </div>
  //   </div>
  // );

  // Arrow for collapsing/expanding
  /*  const Arrow = () => (
    <div
      className="absolute top-1/2 -translate-y-1/2 z-50 w-6 h-12 flex items-center justify-center cursor-pointer select-none bg-gray-400 hover:bg-gray-500 rounded"
      style={{
        [controlPanelSideState]: -12,
      } as React.CSSProperties}
      onClick={() => setControlPanelVisible(!controlPanelVisibleState)}
      onMouseDown={startResize}
    >
      {controlPanelSideState === "left"
        ? controlPanelVisibleState
          ? "◀"
          : "▶"
        : controlPanelVisibleState
        ? "▶"
        : "◀"}
    </div>
  );

  const panelClasses =
    "bg-gray-200 flex flex-col overflow-hidden transition-all duration-200 relative";
 */
  // return (
  //   <div
  //     className="flex h-screen w-full bg-gray-50"
  //     onMouseMove={onMouseMove}
  //     onMouseUp={stopResize}
  //     onMouseLeave={stopResize}
  //   >
  //     {/* Left Panel */}
  //     {controlPanelVisibleState && controlPanelSideState === "left" && (
  //       <div ref={controlPanelRef} className={panelClasses} style={{ width: controlPanelWidth }}>
  //         <div className="flex-1 p-4">LEFT CONTROLS</div>
  //         <Arrow />
  //       </div>
  //     )}

  //     {/* Main Content */}
  //     <div className="flex-1 flex justify-center items-center">
  //       <div className="p-4 text-center">
  //         <h1 className="text-2xl font-bold text-blue-600">Main Viewer</h1>
  //         <button className="px-4 py-2 mt-4 bg-green-500 text-white rounded">
  //           Tailwind Button
  //         </button>
  //       </div>
  //     </div>

  //     {/* Right Panel */}
  //     {controlPanelVisibleState && controlPanelSideState === "right" && (
  //     <div className="bg-gray-100 flex flex-col" style={{ width: controlPanelWidth }}>
  //       {/* Resizer */}
  //       <div
  //         ref={resizerRef}
  //         onMouseDown={startResize}
  //         className="w-2 cursor-ew-resize bg-gray-300 hover:bg-gray-400 self-start"
  //       />
  //       <div className="flex-1 p-4">RIGHT CONTROLS</div>
  //     </div>
  //     )}
  //   </div>
  // );

      return (
    <div
      ref={baseDivRef}
      className="flex-1 h-full w-full"
      style={{
        border: debug ? "5px solid red" : "none",
      }}
    >
 
 <div className={`drawer drawer-open ${controlPanelSideState === "right" ? "drawer-end" : ""}`}>
  <input id="control-panel-drawer" type="checkbox" className="drawer-toggle" 
   defaultChecked={controlPanelVisibleState} // checkbox is checked if drawer should be visible
   onChange={(e) => setControlPanelVisible(e.target.checked)}
  />
  <div className="drawer-content">
    {/* Page content here */}
    <div ref={viewRef} />
  </div>

  <div className="drawer-side is-drawer-close:overflow-visible">
    <label htmlFor="control-panel-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
    <div className="is-drawer-close:w-14 is-drawer-open:w-64 bg-gray-100 flex flex-col items-start min-h-full">
      {/* Sidebar content here */}
      <ul className="menu w-full grow">

        {/* list item */}
        <li>
          <button className="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Homepage">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor" className="inline-block size-4 my-1.5"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
            <span className="is-drawer-close:hidden">Homepage</span>
          </button>
        </li>

        {/* list item */}
        <li>
          <button className="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Settings">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor" className="inline-block size-4 my-1.5"><path d="M20 7h-9"></path><path d="M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>
            <span className="is-drawer-close:hidden">Settings</span>
          </button>
        </li>
      </ul>

      {/* button to open/close drawer */}
      <div className="m-2 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Open">
        <label htmlFor="control-panel-drawer" className="btn btn-ghost btn-circle drawer-button is-drawer-open:rotate-y-180">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor" className="inline-block size-4 my-1.5"><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path><path d="M9 4v16"></path><path d="M14 10l2 2l-2 2"></path></svg>
        </label>
      </div>

    </div>
  </div>
</div>
</div>
  );

  //      return (
  //   <div className="flex items-center justify-center h-screen bg-gray-100">
  //     <button className="btn btn-primary">DaisyUI Button</button>
  //   </div>
  // );
}
