import React, { useEffect, useRef, useState } from "react";

import '@kitware/vtk.js/Rendering/Profiles/Geometry';

// import vtkRenderWindow from "@kitware/vtk.js/Rendering/Core/RenderWindow";
// import vtkRenderWindowInteractor from "@kitware/vtk.js/Rendering/Core/RenderWindowInteractor";
// import vtkRenderer from "@kitware/vtk.js/Rendering/Core/Renderer";
// import vtkOpenGLRenderWindow from "@kitware/vtk.js/Rendering/OpenGL/RenderWindow";
// import vtkInteractorStyleImage from "@kitware/vtk.js/Interaction/Style/InteractorStyleImage";
// import vtkImageMapper from "@kitware/vtk.js/Rendering/Core/ImageMapper";
// import vtkImageSlice from "@kitware/vtk.js/Rendering/Core/ImageSlice";
import vtkImageData from "@kitware/vtk.js/Common/DataModel/ImageData";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
// import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";
// import vtkColorTransferFunction from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction";
// import vtkPiecewiseFunction from "@kitware/vtk.js/Common/DataModel/PiecewiseFunction";
// import vtkPaintFilter from "@kitware/vtk.js/Filters/General/PaintFilter";
// import "@kitware/vtk.js/Rendering/Profiles/Geometry";

// Inspired by https://kitware.github.io/vtk-js/examples/PaintWidget.html


import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkWidgetManager from '@kitware/vtk.js/Widgets/Core/WidgetManager';
import vtkPaintWidget from '@kitware/vtk.js/Widgets/Widgets3D/PaintWidget';
import vtkRectangleWidget from '@kitware/vtk.js/Widgets/Widgets3D/RectangleWidget';
import vtkEllipseWidget from '@kitware/vtk.js/Widgets/Widgets3D/EllipseWidget';
import vtkSplineWidget from '@kitware/vtk.js/Widgets/Widgets3D/SplineWidget';

//ALREADY DEFINED
import vtkInteractorStyleImage from '@kitware/vtk.js/Interaction/Style/InteractorStyleImage';

import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';
import vtkPaintFilter from '@kitware/vtk.js/Filters/General/PaintFilter';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';

import vtkCubeSource from '@kitware/vtk.js/Filters/Sources/CubeSource';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';

//Reader with compression
import vtkHttpDataSetReader from '@kitware/vtk.js/IO/Core/HttpDataSetReader';
//import vtkDataAccessHelper from '@kitware/vtk.js/IO/Core/DataAccessHelper';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';
//import '@kitware/vtk.js/IO/Core/DataAccessHelper/JSZipDataAccessHelper';

import {
  BehaviorCategory,
  ShapeBehavior,
} from '@kitware/vtk.js/Widgets/Widgets3D/ShapeWidget/Constants';

import { ViewTypes } from '@kitware/vtk.js/Widgets/Core/WidgetManager/Constants';

//Helper functions
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

function pixelSourceToVtkImageData({ width, height, data }) {
  console.log("pixelSourceToVtkImageData", width, height, data);
  if (
    !(
      data instanceof Uint8Array ||
      data instanceof Uint16Array ||
      data instanceof Int16Array ||
      data instanceof Float32Array ||
      data instanceof Float64Array
    )
  ) {
    throw new Error("Invalid pixel data: not a typed array");
  }
  const scalars = vtkDataArray.newInstance({
    name: "Scalars", // Required
    numberOfComponents: 1, // Grayscale = 1, RGB = 3, etc.
    values: data, // Must be TypedArray (Uint8Array, Float32Array, etc.)
  });
  const imageData = vtkImageData.newInstance();
  // 3. Set geometry info
  //  imageData.setSpacing([1, 1, 1]);
  //  imageData.setOrigin([0, 0, 0]);
  imageData.setDimensions(width, height, 1);
  imageData.getPointData().setScalars(scalars);
  return imageData;
}

function pixelSourceToUint16VtkImageData({ width, height, data }) {
  console.log("pixelSourceToUint16VtkImageData", width, height, data);

  if (!(data instanceof Float32Array || data instanceof Float64Array)) {
    throw new Error("Expected Float32Array or Float64Array for mapping to Uint16");
  }

  const pixelCount = width * height;

  if (data.length !== pixelCount) {
    throw new Error(`Data length mismatch: expected ${pixelCount}, got ${data.length}`);
  }

  // Compute min/max
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    if (!Number.isNaN(val)) {
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }

  // Handle constant images
  const range = max - min || 1;

  // Map float → Uint16
  const uint16Data = new Uint16Array(pixelCount);
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - min) / range;
    uint16Data[i] = Math.round(normalized * 65535);
  }

  // Assuming `data` is a Float32Array or similar
  const uint8Data = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - min) / range;
    uint8Data[i] = Math.round(normalized * 255);
  }



  console.log(uint16Data);
  // Create VTK image
  const scalars = vtkDataArray.newInstance({
    name: 'ImageScalars',
    numberOfComponents: 1,
    vtkClass: "vtkDataArray",
    values: uint8Data,
  });

  const imageData = vtkImageData.newInstance();
  //imageData.setDimensions(width, height, 1);
  imageData.setDimensions(width, height, 1);
  imageData.setSpacing([1, 1, 1]);
  imageData.setOrigin([0, 0, 0]);
  imageData.getPointData().setScalars(scalars);


  return imageData;
}

export default function VtkViewer2D({
  loader,
  selection,
  width = 1024,
  height = 512,
  zoomLock = true,
  panLock = true,
  debug = false,
}) {
  const viewRef = useRef(null);

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

  const sceneRef = useRef(null);

  // const [containerWidth, setContainerWidth] = useState(width);
  // const [containerHeight, setContainerHeight] = useState(height);

  // useEffect(() => {
  //   const handleResize = () => {
  //     if (viewRef.current) {
  //       setContainerWidth(viewRef.current.clientWidth);
  //       setContainerHeight(
  //         Math.min(window.innerHeight, viewRef.current.clientHeight),
  //       );
  //     }
  //   };

  //   // Resize observer to adjust the size when container size changes
  //   const resizeObserver = new ResizeObserver(handleResize);
  //   if (viewRef.current) {
  //     resizeObserver.observe(viewRef.current);
  //   }

  //   // Properly handle shrink
  //   window.addEventListener("resize", handleResize);

  //   // Cleanup on component unmount
  //   return () => {
  //     resizeObserver.disconnect();
  //   };
  // }, []);

  useEffect(() => {
    let isCancelled = false;
    // Ensure viewRef.current is not null
    if (!viewRef.current) {
      console.error("viewRef.current is null");
      return;
    };



    const setupViewx = (viewContainer, vtk_imageData) => {

      // ----------------------------------------------------------------------------
      // Standard rendering code setup
      // ----------------------------------------------------------------------------

      // scene setup
      if (!sceneRef.current) {
        sceneRef.current = {}
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
        iStyle.setInteractionMode('IMAGE_SLICING');
        renderWindow.getInteractor().setInteractorStyle(iStyle);
        sceneRef.current = {
          fullScreenRenderer,
          renderer,
          renderWindow,
          camera,
          iStyle,
        };
      }
      const scene = sceneRef.current;
      console.log("scene:", scene);
      console.log("vtk_imageData:", vtk_imageData);


      scene.widgetManager = vtkWidgetManager.newInstance();
      scene.widgetManager.setRenderer(scene.renderer);
      // Widgets

      scene.image = {
        imageMapper: vtkImageMapper.newInstance(),
        actor: vtkImageSlice.newInstance(),
      };

      // background image pipeline
      scene.image.actor.setMapper(scene.image.imageMapper);


      // set up labelMap color and opacity mapping
      const range = vtk_imageData.getPointData().getScalars().getRange();
      console.log("Scalar range:", range);
      // Create and configure color transfer function (black to white)
      const ctf = vtkColorTransferFunction.newInstance();
      ctf.addRGBPoint(0, 0.0, 0.0, 0.0);
      ctf.addRGBPoint(255, 1.0, 1.0, 1.0);

      const pf = vtkPiecewiseFunction.newInstance();
      pf.addPoint(range[0], 1.0);
      pf.addPoint(range[1], 1.0);

      // Apply to image slice actor
      const imageProp = scene.image.actor.getProperty();
      imageProp.setRGBTransferFunction(0, ctf);
      imageProp.setScalarOpacity(0, pf);
      imageProp.setUseLookupTableScalarRange(true);

      console.group('vtkImageProperty Debug Info');

      console.log('Interpolation Type:', imageProp.getInterpolationTypeAsString());
      console.log('Opacity:', imageProp.getOpacity());
      console.log('Color Window:', imageProp.getColorWindow());
      console.log('Color Level:', imageProp.getColorLevel());
      console.log('Independent Components:', imageProp.getIndependentComponents());
      console.log('Use Label Outline:', imageProp.getUseLabelOutline());
      console.log('Label Outline Opacity:', imageProp.getLabelOutlineOpacity());
      console.log('Label Outline Thickness:', imageProp.getLabelOutlineThickness());

      console.log("CTF nodes");
      const ctf0 = imageProp.getRGBTransferFunction(0);
      const size = ctf0.getSize();
      for (let i = 0; i < size; i++) {
        const node = [0, 0, 0, 0, 0, 0]; // X, R, G, B, midpoint, sharpness
        ctf0.getNodeValue(i, node);
        console.log(`Node ${i}:`, node);
      }

      console.log("PF nodes");
      const pf0 = imageProp.getScalarOpacity(0);
      const sizepf = pf0.getSize();
      for (let i = 0; i < sizepf; i++) {
        const node = [0, 0, 0, 0]; // X, Y, midpoint, sharpness
        pf0.getNodeValue(i, node);
        console.log(`Opacity Node ${i}:`, node);
      }

      // Component Weights
      for (let i = 0; i < 3; i++) {
        try {
          console.log(`Component Weight [${i}]:`, imageProp.getComponentWeight(i));
        } catch (e) {
          break; // Stop if the component doesn't exist
        }
      }

      console.groupEnd();


      scene.image.imageMapper.setInputData(vtk_imageData);
     

      // add actors to renderers
      scene.renderer.addViewProp(scene.image.actor);

      // default slice orientation/mode and camera view
      const sliceMode = vtkImageMapper.SlicingMode.K;
      scene.image.imageMapper.setSlicingMode(sliceMode);
      scene.image.imageMapper.setSlice(0);
 scene.image.imageMapper.update();
      const scalars = vtk_imageData.getPointData().getScalars();
      const values = scalars.getData();
      const numVoxels = values.length;
      let min = values[0];
      let max = values[0];
      for (let i = 1; i < numVoxels; i++) {
        if (values[i] < min) {
          min = values[i];
        }
        if (values[i] > max) {
          max = values[i];
        }
      }
      console.log("Scalars:", scalars);
      console.log("Values:", values);
      console.log(`Data range: [${min}, ${max}]`);

      // set 2D camera position
      setCamera(sliceMode, scene.renderer, vtk_imageData);

      /*
      updateControlPanel(image.imageMapper, data);
  */

      //update
      const ijk = [0, 0, 0];
      const position = [0, 0, 0];

      // position
      ijk[sliceMode] = scene.image.imageMapper.getSlice();
      vtk_imageData.indexToWorld(ijk, position);


      // Create cube geometry
      const cubeSource = vtkCubeSource.newInstance({
        xLength: 100,
        yLength: 200,
        zLength: 10,
        center: [0, 0, 0],
      });

      // Mapper
      const cubeMapper = vtkMapper.newInstance();
      cubeMapper.setInputConnection(cubeSource.getOutputPort());

      // Actor
      const cubeActor = vtkActor.newInstance();
      cubeActor.setMapper(cubeMapper);

      // Add cube actor to renderer
      scene.renderer.addActor(cubeActor);

      // update labelMap layer
      //scene.renderer.resetCamera();
      scene.renderWindow.render();

    };


    const setupView = (viewContainer, vtk_imageData) => {
      if (!vtkObjectsRef.current.renderWindow) {
        vtkObjectsRef.current.renderWindow = vtkRenderWindow.newInstance();
        vtkObjectsRef.current.renderer = vtkRenderer.newInstance({
          background: [0.5, 0.5, 0.5],
        });
        vtkObjectsRef.current.renderWindow.addRenderer(
          vtkObjectsRef.current.renderer,
        );

        vtkObjectsRef.current.openGLRenderWindow =
          vtkOpenGLRenderWindow.newInstance();
        vtkObjectsRef.current.openGLRenderWindow.setContainer(viewContainer);
        vtkObjectsRef.current.openGLRenderWindow.setSize(
          containerWidth,
          containerHeight,
        );
        vtkObjectsRef.current.renderWindow.addView(
          vtkObjectsRef.current.openGLRenderWindow,
        );

        // Create an interactor to handle events (like mouse control)
        vtkObjectsRef.current.interactor =
          vtkRenderWindowInteractor.newInstance();
        vtkObjectsRef.current.interactor.setView(
          vtkObjectsRef.current.openGLRenderWindow,
        );
        vtkObjectsRef.current.interactor.initialize();
        vtkObjectsRef.current.interactor.bindEvents(viewContainer);

        //Create a mapper and set its input connection
        vtkObjectsRef.current.mapper = vtkImageMapper.newInstance();
        vtkObjectsRef.current.mapper.setInputData(vtk_imageData);
        //DIFFERENT than VTKVIEWER
        //Create a painter to paint on the image
        vtkObjectsRef.current.painter = vtkPaintFilter.newInstance();
        vtkObjectsRef.current.painter.setBackgroundImage(vtk_imageData);
        vtkObjectsRef.current.painter.setLabel(1); // Label value to paint with
        vtkObjectsRef.current.mapper.setInputConnection(
          vtkObjectsRef.current.painter.getOutputPort(),
        );
        const sliceMode = vtkImageMapper.SlicingMode.K; // Z axis
        vtkObjectsRef.current.mapper.setSlicingMode(sliceMode);
        vtkObjectsRef.current.mapper.setSlice(0); // First slice
        vtkObjectsRef.current.painter.setSlicingMode(sliceMode);

        const camera = vtkObjectsRef.current.renderer.getActiveCamera();
        camera.setParallelProjection(true);

        setCamera(sliceMode, vtkObjectsRef.current.renderer, vtk_imageData);

        //Set the mapper to use the full extent of the data
        vtkObjectsRef.current.iStyle = vtkInteractorStyleImage.newInstance();
        vtkObjectsRef.current.iStyle.setInteractionMode("IMAGE_SLICING");
        vtkObjectsRef.current.interactor.setInteractorStyle(
          vtkObjectsRef.current.iStyle,
        );
        //	const extent = vtk_imageData.getExtent();
        //	vtkObjectsRef.current.mapper.setSlice(extent[5] / 2); // Middle slice
        //	vtkObjectsRef.current.mapper.setColorWindow(255);
        //	vtkObjectsRef.current.mapper.setColorLevel(127.5);
        //vtkObjectsRef.current.mapper.setUseLookupTableScalarRange(true);
        // Apply window/level

        //Create an actor to represent the image
        //DIFFERENT actor is now  vtkImageSlice not vtkActor
        vtkObjectsRef.current.actor = vtkImageSlice.newInstance();
        vtkObjectsRef.current.actor.setMapper(vtkObjectsRef.current.mapper);

        // Apply window/level
        // Get scalar range from the image data
        const range = vtk_imageData.getPointData().getScalars().getRange();
        console.log("Scalar range:", range);
        // Create and configure color transfer function (black to white)
        //
        vtkObjectsRef.current.colorTransferFunction =
          vtkColorTransferFunction.newInstance();
        vtkObjectsRef.current.colorTransferFunction.addRGBPoint(
          range[0],
          0.0,
          0.0,
          0.0,
        ); // Black at min
        vtkObjectsRef.current.colorTransferFunction.addRGBPoint(
          range[1],
          1.0,
          1.0,
          1.0,
        ); // White at max
        // Create and configure piecewise function for opacity (fully opaque)
        vtkObjectsRef.current.piecewiseFunction =
          vtkPiecewiseFunction.newInstance();
        vtkObjectsRef.current.piecewiseFunction.addPoint(range[0], 0.0); // Transparent at min
        vtkObjectsRef.current.piecewiseFunction.addPoint(range[1], 1.0); // Opaque at max

        vtkObjectsRef.current.actor
          .getProperty()
          .setRGBTransferFunction(vtkObjectsRef.current.colorTransferFunction);
        vtkObjectsRef.current.actor.getProperty().setOpacity(0.5); // Fully opaque

        //      vtkObjectsRef.current.actor.getProperty().setPiecewiseFunction(vtkObjectsRef.current.piecewiseFunction);

        //Add the actor to the renderer
        //vtkObjectsRef.current.renderer.addActor(vtkObjectsRef.current.actor);
        vtkObjectsRef.current.renderer.addViewProp(vtkObjectsRef.current.actor);
        vtkObjectsRef.current.renderer.resetCamera();
        //vtkObjectsRef.current.renderer.resetCamera();

        //Render the scene
        vtkObjectsRef.current.renderWindow.render();

        // Set up interactor style for image viewing (pan/zoom)
        //	const interactorStyle = vtkObjectsRef.current.interactor.getInteractorStyle();
        //	interactorStyle.setInteractionMode('IMAGE_SLICER');
        //	interactorStyle.setZoomFactor(1.5); // Adjust zoom sensitivity if needed
        //	interactorStyle.setPanFactor(1.5); // Adjust pan sensitivity if needed
        //	interactorStyle.setScrollFactor(1.1); // Adjust scroll sensitivity if needed

        console.log(
          "Actor property:",
          vtkObjectsRef.current.actor.getProperty(),
        );
        console.log(
          "ColorWindow:",
          vtkObjectsRef.current.actor.getProperty().getColorWindow(),
        );
        console.log(
          "ColorLevel:",
          vtkObjectsRef.current.actor.getProperty().getColorLevel(),
        );
        console.log(
          "RGBTransferFunction:",
          vtkObjectsRef.current.actor.getProperty().getRGBTransferFunction(),
        );
        console.log("Scalar range used:", range);
      } else {
        //      if (syncCamera) {
        //        const camera = renderer.getActiveCamera();
        //        camera.onModified(() => {
        //          syncCamera.setPosition(...camera.getPosition());
        //          syncCamera.setFocalPoint(...camera.getFocalPoint());
        //          syncCamera.setViewUp(...camera.getViewUp());
        //          syncCamera.modified();
        //        });
        //      }
        vtkObjectsRef.current.openGLRenderWindow.setSize(
          containerWidth,
          containerHeight,
        );
        vtkObjectsRef.current.mapper.setInputData(vtk_imageData);
        vtkObjectsRef.current.renderer.resetCamera();
        vtkObjectsRef.current.renderWindow.render();
      }
    };

    const init = async () => {
      console.log("loader:", loader);
      console.log("selection:", selection);
      const raster = await (
        Array.isArray(loader) ? loader[0] : loader
      ).getRaster({ selection: selection || { z: 0 } });
      if (isCancelled) return;
      //const vtkImage = pixelSourceToVtkImageData(raster);
      const vtkImage = pixelSourceToUint16VtkImageData(raster);
      setupViewx(viewRef.current, vtkImage);

    };

    const initSync = () => {
      console.log("loader:", loader);
      console.log("selection:", selection);

      const rasterPromise = (
        Array.isArray(loader) ? loader[0] : loader
      ).getRaster({ selection: selection || { z: 0 } });

      rasterPromise.then((raster) => {
        const vtkImage = pixelSourceToUint16VtkImageData(raster);
        setupViewx(viewRef.current, vtkImage);
        continueAfterInit(); // Only proceed after raster is ready
      }).catch((err) => {
        console.error("Failed to load raster:", err);
      });
    };

    const initExample = async () => {
      try {
        const reader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });
        const url = 'https://131.169.168.138:8080/LIDC2.vti/'
        //const url = '/home/kulvaitv/BIG/git/vtk-js/Data/volume/LIDC2.vti'
        await reader.setUrl(url, { loadData: true });
        const vtkImage = reader.getOutputData();

        // Now call your existing setup function with the vtkImage
        setupViewx(viewRef.current, vtkImage);
      } catch (err) {
        console.error('Failed to load VTK dataset:', err);
      }
    };

    initExample();
    // Set up left renderer


    // Cleanup function to avoid setting state after unmount
    return () => {
      isCancelled = true;
    };

  }, [viewRef]);

  return (
    <div
      ref={viewRef}
      className="flex-1 h-full w-full"
      style={{
        border: debug ? "5px solid red" : "none",
      }}
    />
  );
}
