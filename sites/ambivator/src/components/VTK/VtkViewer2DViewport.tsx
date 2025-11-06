import React, {
  memo,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";

// Logic inspired by https://kitware.github.io/vtk-js/examples/PaintWidget.html

import "@kitware/vtk.js/Rendering/Profiles/All";

import vtkImageData from "@kitware/vtk.js/Common/DataModel/ImageData";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkRenderWindow from "@kitware/vtk.js/Rendering/Core/RenderWindow";
import vtkOpenGLRenderWindow from "@kitware/vtk.js/Rendering/OpenGL/RenderWindow";
import vtkRenderWindowInteractor from "@kitware/vtk.js/Rendering/Core/RenderWindowInteractor";
import vtkRenderer from "@kitware/vtk.js/Rendering/Core/Renderer";
import vtkInteractorStyleImage from "@kitware/vtk.js/Interaction/Style/InteractorStyleImage";
import vtkCustomInteractorStyleImage from "./vtkCustomInteractorStyleImage";
import vtkImageMapper from "@kitware/vtk.js/Rendering/Core/ImageMapper";
import vtkImageSlice from "@kitware/vtk.js/Rendering/Core/ImageSlice";
import vtkColorTransferFunction from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction";
import vtkPiecewiseFunction from "@kitware/vtk.js/Common/DataModel/PiecewiseFunction";
import vtkCubeSource from "@kitware/vtk.js/Filters/Sources/CubeSource";
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";
import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";

import vtkInteractorStyleManipulator from "@kitware/vtk.js/Interaction/Style/InteractorStyleManipulator";
import vtkMouseCameraTrackballZoomManipulator from "@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballZoomManipulator";

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

import noUiSlider from "nouislider";
import type { VtkViewer } from "@hms-dbmi/viv";
import { set } from "@kitware/vtk.js/macros";

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

export interface VtkViewer2DViewportProps {
  loader: any;
  frameCount: number;
  initialFrameIndex?: number;
  selection?: any;
  width?: number;
  height?: number;
  onReady?: () => void;
  debug?: boolean;
  enableWheelZoom?: boolean;
}

export interface VtkViewer2DViewportRef {
  readFrame: (index: number) => Promise<void>;
}

const VtkViewer2DViewport = forwardRef<
  VtkViewer2DViewportRef,
  VtkViewer2DViewportProps
>(
  (
    {
      loader,
      frameCount,
      initialFrameIndex = 0,
      selection,
      width = 1024,
      height = 512,
      onReady,
      debug = false,
      enableWheelZoom = true,
    },
    ref,
  ) => {
    const gaussianWidgetDivRef = useRef<HTMLDivElement>(null);
    const viewerDivRef = useRef<HTMLDivElement>(null);

    const [frameIndex, setFrameIndex] = useState<number>(
      initialFrameIndex ?? 0,
    );
    useEffect(() => {
      if (initialFrameIndex !== frameIndex) {
        setFrameIndex(initialFrameIndex);
      }
    }, [initialFrameIndex]);

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

    // NEW: react to frameIndex changes
    const latestTaskRef = useRef<symbol | null>(null);
    const latestTaskFrameId = useRef<number | null>(null);
    const pendingFrameRef = useRef<number | null>(null);
    const loadingTasksRef = useRef<Set<symbol>>(new Set());
    const debounceTimerRef = useRef<number | null>(null);
    const [displayedFrameId, setDisplayedFrameId] = useState<number | null>(
      null,
    );

    useEffect(() => {
      let cancelled = false;

      (async () => {
        if (loadingTasksRef.current.size == 0) {
          await loadAndDisplayImage(frameIndex);
        } else {
          // debounce logic
          pendingFrameRef.current = frameIndex;
          console.log("Postponed index:", frameIndex);
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            if (
              pendingFrameRef.current !== null &&
              frameIndex === pendingFrameRef.current &&
              !cancelled
            ) {
              loadAndDisplayImage(pendingFrameRef.current);
              if (frameIndex === pendingFrameRef.current) {
                pendingFrameRef.current = null;
              }
            }
          }, 200);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [frameIndex, frameCount, loader, selection]);

    const loadAndDisplayImage = async (index: number) => {
      if (!loader) return;
      if (!loader) {
        console.warn("No loader provided");
        return;
      }
      if (frameCount <= 0) return;
      if (frameIndex < 0 || frameIndex >= frameCount) return;

      const taskId = Symbol();
      latestTaskRef.current = taskId;
      latestTaskFrameId.current = frameIndex;
      loadingTasksRef.current.add(taskId);

      const raster = await (
        Array.isArray(loader) ? loader[0] : loader
      ).getRaster({ selection: selection || { z: index } });
      const vtkImage = pixelSourceToVtkImageData(raster);
      updateImageRef(imageRef, vtkImage);
      // Update the image in the existing pipeline
      const scene = vtkObjectsRef.current;
      if (scene.image.mapper && scene.renderWindow) {
        const { range: imageRange } = imageRef.current!;

        // Update mapper with new image data
        scene.image.mapper.setInputData(vtkImage);

        // Update color transfer function range if needed
        if (scene.image.ctf && imageRange) {
          scene.image.ctf.removeAllPoints();
          scene.image.ctf.addRGBPoint(imageRange[0], 0.0, 0.0, 0.0);
          scene.image.ctf.addRGBPoint(imageRange[1], 1.0, 1.0, 1.0);
        }

        // Update piecewise function range if needed
        if (scene.image.pf && imageRange) {
          scene.image.pf.removeAllPoints();
          scene.image.pf.addPoint(imageRange[0], 1.0);
          scene.image.pf.addPoint(imageRange[1], 1.0);
        }

        // Update CTF widget if it exists
        if (scene.image.ctfWidget && imageRange) {
          const { data: imageData } = imageRef.current!;
          scene.image.ctfWidget.setDataArray(imageData);
        }

        scene.renderWindow.render();
        setDisplayedFrameId(index);
        console.log("Loaded index:", index);
      }
    };

    useImperativeHandle(ref, () => ({
      readFrame: async (index: number) => {
        setFrameIndex(index);
      },
    }));

    useEffect(() => {
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
          const iStyle = vtkCustomInteractorStyleImage.newInstance();
          console.log("iStyle:", iStyle);

          interactor.setInteractorStyle(iStyle);

          console.log("Handlewheel:", interactor.handleWheel);
          console.log("Handlewheel istyle:", iStyle.handleMouseWheel);
          console.log("Handle left down:", iStyle.handleLeftButtonPress);

          // interactor.handleWheel =  (event) => {
          //     event.stopPropagation();
          //     event.preventDefault();

          //     let wheelDelta = 0;
          //     // let mode = '';
          //     if (event.wheelDeltaX === undefined) {
          //       // mode = 'detail';
          //       wheelDelta = -event.detail * 2;
          //     } else {
          //       // mode = 'wheelDeltaY';
          //       wheelDelta = event.wheelDeltaY;
          //     }
          //     const callData = {
          //       wheelDelta: Math.max(0.01, (wheelDelta + 1000.0) / 1000.0),
          //     };

          //     if (model.wheelTimeoutID === 0) {
          //       publicAPI.startMouseWheelEvent(callData);
          //       publicAPI.mouseWheelEvent(callData);          // ADDED CODE
          //     } else {
          //       publicAPI.mouseWheelEvent(callData);
          //       clearTimeout(model.wheelTimeoutID);
          //     }

          //           iStyle.handleMouseWheel = enableWheelZoom;
          //           //iStyle.setInteractionMode("IMAGE_SLICING");
          //           //renderWindow.getInteractor().setInteractorStyle(iStyle);
          //           const zoomManipulator = vtkMouseCameraTrackballZoomManipulator.newInstance();
          //           zoomManipulator.setScrollEnabled(true);
          //          // iStyle.addManipulator(zoomManipulator, 10); // 10 is the priority
          //           renderWindow.getInteractor().setInteractorStyle(iStyle);
          //           if(false){
          //             const manipulatorStyle = vtkInteractorStyleManipulator.newInstance();
          //             const zoomManipulator = vtkMouseCameraTrackballZoomManipulator.newInstance();
          //             zoomManipulator.setScrollEnabled(true);
          //             manipulatorStyle.addManipulator(zoomManipulator, 10); // 10 is the priority
          //             renderWindow.getInteractor().setInteractorStyle(manipulatorStyle);
          //            // interactor.setInteractorStyle(manipulatorStyle);
          //           }

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
          widgetContainer.style.position = "relative";
          //widgetContainer.style.top = "10px";
          //widgetContainer.style.left = "10px";
          widgetContainer.style.background = "rgba(255, 255, 255, 0.8)";
          gaussianWidgetDivRef.current?.appendChild(widgetContainer);
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
          //widget.setDataArray(imageData);
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
          orientationWidget.setViewportSize(0.05);
          orientationWidget.setMinPixelSize(100);
          orientationWidget.setMaxPixelSize(300);

          // Render scene
          scene.renderWindow.render();
        }
      };

      const init = async () => {
        console.log("loader:", loader);
        console.log("selection:", selection);
        if (!loader) {
          console.warn("No loader provided");
          return;
        } else if (Array.isArray(loader)) {
          //Stack of different resolutions
          console.log("loader.shape:", loader[0].shape);
        } else {
          console.log("loader.shape():", loader.shape);
        }
        await loadAndDisplayImage(initialFrameIndex);
        if (viewerDivRef.current && imageRef.current.vtk_imageData) {
          setupView(viewerDivRef.current, imageRef.current!.vtk_imageData!);
        }
      };

      //Initialize and draw image
      init();

      // Cleanup function to avoid setting state after unmount
      return () => {};
    }, [viewerDivRef]);

    return <div ref={viewerDivRef} />;
  },
);

export default memo(
  VtkViewer2DViewport,
  (prev, next) =>
    prev.loader === next.loader &&
    prev.frameCount === next.frameCount &&
    prev.initialFrameIndex === next.initialFrameIndex &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.debug === next.debug &&
    prev.selection === next.selection, // assumes selection is stable reference
);
