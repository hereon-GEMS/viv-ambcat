import React, { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

// Logic inspired by https://kitware.github.io/vtk-js/examples/PaintWidget.html

import "@kitware/vtk.js/Rendering/Profiles/All";

import vtkImageData from "@kitware/vtk.js/Common/DataModel/ImageData";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkRenderWindow from "@kitware/vtk.js/Rendering/Core/RenderWindow";
import vtkOpenGLRenderWindow from "@kitware/vtk.js/Rendering/OpenGL/RenderWindow";
import vtkRenderWindowInteractor from "@kitware/vtk.js/Rendering/Core/RenderWindowInteractor";
import vtkRenderer from "@kitware/vtk.js/Rendering/Core/Renderer";
import vtkInteractorStyleImage from "@kitware/vtk.js/Interaction/Style/InteractorStyleImage";
import vtkImageMapper from "@kitware/vtk.js/Rendering/Core/ImageMapper";
import vtkImageSlice from "@kitware/vtk.js/Rendering/Core/ImageSlice";
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
  const viewerDivRef = useRef<HTMLDivElement>(null);
  const controlPanelDivRef = useRef<HTMLDivElement>(null);
  // Control panel setup
  const [controlPanelVisibleState, setControlPanelVisible] =
    useState(controlPanelVisible);
  const [controlPanelSideState, setControlPanelSide] = useState<
    "left" | "right"
  >(controlPanelSide);

  const [controlPanelWidth, setControlPanelWidth] = useState(300); // initial width

  // Define types for clarity
  type VtkImagePipeline = {
    mapper: vtkImageMapper | null;
    actor: vtkImageSlice | null;
    ctf: vtkColorTransferFunction | null;
    pf: vtkPiecewiseFunction | null;
    ctfWidget: any | null; // vtkPiecewiseGaussianWidget later
  };

  type VtkObjectsType = {
    renderWindow: vtkRenderWindow | null;
    openGLRenderWindow: vtkOpenGLRenderWindow | null;
    interactor: vtkRenderWindowInteractor | null;
    renderer: vtkRenderer | null;
    camera: any | null;
    iStyle: vtkInteractorStyleImage | null;
    image: VtkImagePipeline;
  };

  // 2️d Top-level ref
  const vtkObjectsRef = useRef<VtkObjectsType>({
    renderWindow: null,
    openGLRenderWindow: null,
    interactor: null,
    renderer: null,
    camera: null,
    iStyle: null,
    image: {
      mapper: null,
      actor: null,
      ctf: null,
      pf: null,
      ctfWidget: null,
    },
  });

  // Type for the ref structure
  type ImageRefType = {
    vtk_imageData: vtkImageData | null;
    scalars: any | null;
    data: any | null;
    range: [number, number] | null;
  };

  const imageRef = useRef<ImageRefType>({
    vtk_imageData: null,
    scalars: null,
    data: null,
    range: null,
  });

  function updateImageRef(
    imageRef: RefObject<ImageRefType>,
    vtk_imageData: vtkImageData,
  ): boolean {
    if (!imageRef.current) {
      // should never happen if you initialized with object, but TS likes this check
      return false;
    }

    if (imageRef.current.vtk_imageData !== vtk_imageData) {
      const scalars = vtk_imageData.getPointData().getScalars();
      const data = scalars.getData();
      const range = scalars.getRange() as [number, number];
      imageRef.current = {
        vtk_imageData,
        scalars,
        data,
        range,
      };
      console.log("Updated imageRef with new vtk_imageData:", range);
      return true;
    }
    return false;
  }

  useEffect(() => {
    //return;
    // Ensure viewRef.current is not null
    if (!viewerDivRef.current) {
      console.error("viewRef.current is null");
      return;
    }
    const setupView = (
      viewContainerElement: HTMLElement,
      vtk_imageData: vtkImageData,
    ) => {
      // Set basic image properties from updated imageRef
      updateImageRef(imageRef, vtk_imageData);
      const { scalars: imageScalars, data: imageData } = imageRef.current!;
      const imageRange = imageRef.current.range ?? [0, 1]; // fallback to [0,1] if null

      // ----------------------------------------------------------------------------
      // Standard rendering code setup
      // ----------------------------------------------------------------------------
      if (!vtkObjectsRef.current || !vtkObjectsRef.current.renderWindow) {
        // Create the render window
        const renderWindow = vtkRenderWindow.newInstance();
        const renderer = vtkRenderer.newInstance();
        renderer.setBackground(0.1, 0.2, 0.4); // Set background color
        renderWindow.addRenderer(renderer);

        const openGLRenderWindow = vtkOpenGLRenderWindow.newInstance();
        openGLRenderWindow.setContainer(viewContainerElement);
        //Dimensions of div
        const containerWidth = viewContainerElement.clientWidth;
        const containerHeight = viewContainerElement.clientHeight;
        openGLRenderWindow.setSize(containerWidth, containerHeight);
        renderWindow.addView(openGLRenderWindow);

        // Create an interactor to handle events (like mouse control)
        const interactor = vtkRenderWindowInteractor.newInstance();
        interactor.setView(openGLRenderWindow);
        interactor.initialize();
        interactor.setContainer(viewContainerElement);

        const camera = renderer.getActiveCamera();

        // setup 2D view
        camera.setParallelProjection(true);
        const iStyle = vtkInteractorStyleImage.newInstance();
        iStyle.setInteractionMode("IMAGE_SLICING");
        renderWindow.getInteractor().setInteractorStyle(iStyle);

        // Initialize image pipeline
        const mapper = vtkImageMapper.newInstance();
        const actor = vtkImageSlice.newInstance();
        const ctf = vtkColorTransferFunction.newInstance();
        const pf = vtkPiecewiseFunction.newInstance();

        actor.setMapper(mapper);
        renderer.addActor(actor);

        vtkObjectsRef.current = {
          renderWindow,
          openGLRenderWindow,
          interactor,
          renderer,
          camera,
          iStyle,
          image: {
            mapper,
            actor,
            ctf,
            pf,
            ctfWidget: null,
          },
        };
        //CTF setup
        mapper.setInputData(vtk_imageData);
        ctf.addRGBPoint(imageRange[0], 0.0, 0.0, 0.0);
        ctf.addRGBPoint(imageRange[1], 1.0, 1.0, 1.0);
        pf.addPoint(imageRange[0], 1.0);
        pf.addPoint(imageRange[1], 1.0);
        const imageProp = actor.getProperty();
        imageProp.setRGBTransferFunction(0, ctf);
        imageProp.setScalarOpacity(0, pf);
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
        viewContainerElement.appendChild(widgetContainer);
        //document.body.appendChild(widgetContainer);
        //widget.applyOpacity(sceneRef.current.image.ctf);
        widget.setContainer(widgetContainer);
        widget.setColorTransferFunction(vtkObjectsRef.current.image.ctf);
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
          renderWindow.render();
        });
        vtkObjectsRef.current.image.ctfWidget = widget;
      }

      //Get scene and image objects
      const scene = vtkObjectsRef.current;
      const image = scene.image;

      // default slice orientation/mode and camera view
      const sliceMode = vtkImageMapper.SlicingMode.K;
      if (image.mapper) {
        // default slice orientation/mode and camera view
        const sliceMode = vtkImageMapper.SlicingMode.K;
        image.mapper.setSlicingMode(sliceMode);
        image.mapper.setSlice(0);
        image.mapper.update();
      }

      // set 2D camera position
      setCamera(sliceMode, scene.renderer, vtk_imageData);

      //Add orientation widget
      const axes = vtkAxesActor.newInstance();
      if (scene.renderWindow) {
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
      }
    };

    const init = async () => {
      console.log("loader:", loader);
      console.log("selection:", selection);
      const raster = await (
        Array.isArray(loader) ? loader[0] : loader
      ).getRaster({ selection: selection || { z: 0 } });
      const vtkImage = pixelSourceToVtkImageData(raster);
      setupView(viewerDivRef.current, vtkImage);
    };

    //Initialize and draw image
    init();

    // Cleanup function to avoid setting state after unmount
    return () => {};
  }, [viewerDivRef]);

  return (
    <div
      ref={baseDivRef}
      className="flex-1 h-full w-full"
      style={{
        border: debug ? "5px solid red" : "none",
      }}
    >
      <div
        className={`drawer drawer-open ${controlPanelSideState === "right" ? "drawer-end" : ""}`}
      >
        <input
          id="control-panel-drawer"
          type="checkbox"
          className="drawer-toggle"
          defaultChecked={controlPanelVisibleState} // checkbox is checked if drawer should be visible
          onChange={(e) => setControlPanelVisible(e.target.checked)}
        />
        <div className="drawer-content">
          {/* Page content here */}
          <div ref={viewerDivRef} />
        </div>

        <div
          className="drawer-side is-drawer-close:overflow-visible"
          ref={controlPanelDivRef}
        >
          <label
            htmlFor="control-panel-drawer"
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
                htmlFor="control-panel-drawer"
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

  //      return (
  //   <div className="flex items-center justify-center h-screen bg-gray-100">
  //     <button className="btn btn-primary">DaisyUI Button</button>
  //   </div>
  // );
}
