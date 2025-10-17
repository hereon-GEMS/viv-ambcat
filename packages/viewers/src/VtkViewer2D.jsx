import React, { useEffect, useRef, useState } from "react";

// Logic inspired by https://kitware.github.io/vtk-js/examples/PaintWidget.html

import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import vtkImageData from "@kitware/vtk.js/Common/DataModel/ImageData";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkWidgetManager from '@kitware/vtk.js/Widgets/Core/WidgetManager';
import vtkInteractorStyleImage from '@kitware/vtk.js/Interaction/Style/InteractorStyleImage';
import vtkPaintFilter from '@kitware/vtk.js/Filters/General/PaintFilter';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import vtkTexture from '@kitware/vtk.js/Rendering/Core/Texture';
import vtkScalarsToColors from '@kitware/vtk.js/Common/Core/ScalarsToColors';

//Actors
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkActor2D from "@kitware/vtk.js/Rendering/Core/Actor2D";
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';

//Mappers
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper';

//Sources
import vtkPlaneSource from "@kitware/vtk.js/Filters/Sources/PlaneSource";
import vtkCubeSource from '@kitware/vtk.js/Filters/Sources/CubeSource';


//Reader with compression
import vtkHttpDataSetReader from '@kitware/vtk.js/IO/Core/HttpDataSetReader';
//import vtkDataAccessHelper from '@kitware/vtk.js/IO/Core/DataAccessHelper';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';
//import '@kitware/vtk.js/IO/Core/DataAccessHelper/JSZipDataAccessHelper';

import vtkOrientationMarkerWidget from '@kitware/vtk.js/Interaction/Widgets/OrientationMarkerWidget';
import vtkAxesActor from '@kitware/vtk.js/Rendering/Core/AxesActor';


import {
  BehaviorCategory,
  ShapeBehavior,
} from '@kitware/vtk.js/Widgets/Widgets3D/ShapeWidget/Constants';

import { ViewTypes } from '@kitware/vtk.js/Widgets/Core/WidgetManager/Constants';

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

//Converting raw array to vtkImageData object
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

//
function applyCTFToImage(vtkImageData_instance, ctf, k=0) {
  const dims = vtkImageData_instance.getDimensions(); // [x, y, z]
  const scalars = vtkImageData_instance.getPointData().getScalars().getData();

  const [dimX, dimY, dimZ] = dims;

  if (k < 0 || k >= dimZ) {
    throw new Error(`Invalid slice index k=${k}, image depth is ${dimZ}`);
  }

  const sliceSize = dimX * dimY;
  const sliceOffset = k * sliceSize;

  const rgbaArray = new Uint8Array(sliceSize * 4); // RGBA per pixel

  for (let i = 0; i < sliceSize; i++) {
    const scalar = scalars[sliceOffset + i];
    const rgb = [0, 0, 0];
    ctf.getColor(scalar, rgb);
    rgbaArray[i * 4 + 0] = Math.round(rgb[0] * 255);
    rgbaArray[i * 4 + 1] = Math.round(rgb[1] * 255);
    rgbaArray[i * 4 + 2] = Math.round(rgb[2] * 255);
    rgbaArray[i * 4 + 3] = 255; // fully opaque
  }

  // Create a new 2D image (z = 1)
  const coloredImage = vtkImageData.newInstance();
  coloredImage.setDimensions(dimX, dimY, 1);

  const rgbaDataArray = vtkDataArray.newInstance({
    name: 'RGBA',
    numberOfComponents: 4,
    values: rgbaArray,
  });

  coloredImage.getPointData().setScalars(rgbaDataArray);

  return coloredImage;
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


  useEffect(() => {
    // Ensure viewRef.current is not null
    if (!viewRef.current) {
      console.error("viewRef.current is null");
      return;
    };
    const setupView = (viewContainer, vtk_imageData) => {

      // ----------------------------------------------------------------------------
      // Standard rendering code setup
      // ----------------------------------------------------------------------------

      // Scene setup to reuse resources
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

      // Query and print the dimensions
      const dimensions = vtk_imageData.getDimensions();
      console.log('Dimensions of vtk_imageData:', dimensions);  // Output: [100, 100, 1]

      const scene = sceneRef.current;
      console.log("scene:", scene);
      console.log("vtk_imageData:", vtk_imageData);

      scene.image = {
        imageMapper: vtkImageMapper.newInstance(),
        actor: vtkActor2D.newInstance(),
      };
      scene.image.imageMapper.setInputData(vtk_imageData);
      // background image pipeline
      scene.image.actor.setMapper(scene.image.imageMapper);

      // Trying to configure color transfer function and piecewiseFunction ... but does not work without it as well (black to white)
      const range = vtk_imageData.getPointData().getScalars().getRange();
      const imageProp = scene.image.actor.getProperty();
      const ctf = vtkColorTransferFunction.newInstance();
      ctf.addRGBPoint(range[0], 0.0, 0.0, 0.0);
      ctf.addRGBPoint(range[1], 1.0, 1.0, 1.0);
      const pf = vtkPiecewiseFunction.newInstance();
      pf.addPoint(range[0], 1.0);
      pf.addPoint(range[1], 1.0);


      const color_imageData = applyCTFToImage(vtk_imageData, ctf);
      //const color_imageData = vtk_imageData;
/*
      imageProp.setRGBTransferFunction(0, ctf);
      imageProp.setScalarOpacity(0, pf);
      imageProp.setUseLookupTableScalarRange(true);
      // End playing with transfer functions
*/
 
     // imageProp.setColorWindow(255);
    //  imageProp.setColorLevel(127);

      // add actors to renderers ... both ways do nothing
      //scene.renderer.addViewProp(scene.image.actor);
      scene.renderer.addActor(scene.image.actor);

      // default slice orientation/mode and camera view
      const sliceMode = vtkImageMapper.SlicingMode.K;
      scene.image.imageMapper.setSlicingMode(sliceMode);
      scene.image.imageMapper.setSlice(0);
      scene.image.imageMapper.update();

      // set 2D camera position
      setCamera(sliceMode, scene.renderer, vtk_imageData);


      //Last try
      const ijk = [0, 0, 0];
      const position = [0, 0, 0];
      ijk[sliceMode] = scene.image.imageMapper.getSlice();
      vtk_imageData.indexToWorld(ijk, position);
      //Still without effect


      // Create cube geometry -> Interestingly this works
      const cubeSource = vtkCubeSource.newInstance({
        xLength: 100,
        yLength: 200,
        zLength: 1,
        center: [0, 0, 0],
      });
      const cubeMapper = vtkMapper.newInstance();
      cubeMapper.setInputConnection(cubeSource.getOutputPort());
      const cubeActor = vtkActor.newInstance();
      cubeActor.setMapper(cubeMapper);

      const planeSource = vtkPlaneSource.newInstance({ xResolution: dimensions[0]-1, yResolution: dimensions[1]-1 });
		planeSource.setOrigin(0, 0, 0);
		planeSource.setPoint1(dimensions[0], 0, 0);
		planeSource.setPoint2(0, dimensions[1], 0);
		
      const planeMapper = vtkMapper.newInstance();
      planeMapper.setInputConnection(planeSource.getOutputPort());
		const planeActor = vtkActor.newInstance();
      planeActor.setMapper(planeMapper);
      //planeActor.setMapper(scene.image.imageMapper);
		//planeActor.getProperty().setColor(0, 1, 0); // Green color
		cubeActor.getProperty().setColor(0, 0, 1); // Green color
		const texture = vtkTexture.newInstance();
texture.setInputData(color_imageData);
planeActor.addTexture(texture);



      scene.renderer.addActor(cubeActor);
      scene.renderer.addActor(planeActor);

      const axes = vtkAxesActor.newInstance();
      const orientationWidget = vtkOrientationMarkerWidget.newInstance({
        actor: axes,
        interactor: scene.renderWindow.getInteractor(),
      });
      orientationWidget.setEnabled(true);
      orientationWidget.setViewportCorner(
        vtkOrientationMarkerWidget.Corners.BOTTOM_LEFT
      );
      orientationWidget.setViewportSize(0.15);
      orientationWidget.setMinPixelSize(100);
      orientationWidget.setMaxPixelSize(300);

      // Cube shows up but not 2D image
      scene.renderWindow.render();


      // Extensive logging start
      const scalars = vtk_imageData.getPointData().getScalars();
      const values = scalars.getData();

      console.log("Scalars:", scalars);
      console.log("Values:", values);
      console.log(`Data range: [${range[0]}, ${range[1]}]`);
      console.group('vtkImageProperty Debug Info');
    //  console.log('Interpolation Type:', imageProp.getInterpolationTypeAsString());
      console.log('Opacity:', imageProp.getOpacity());
    // console.log('Color Window:', imageProp.getColorWindow());
    //  console.log('Color Level:', imageProp.getColorLevel());
    //  console.log('Independent Components:', imageProp.getIndependentComponents());
    //  console.log('Use Label Outline:', imageProp.getUseLabelOutline());
    //  console.log('Label Outline Opacity:', imageProp.getLabelOutlineOpacity());
    //  console.log('Label Outline Thickness:', imageProp.getLabelOutlineThickness());
      console.log("CTF nodes");
      console.groupEnd();
      // Extensive logging stop


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

    const initExample = async () => {
      try {
        const reader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });
        const url = 'https://raw.githubusercontent.com/Kitware/vtk-js/master/Data/volume/LIDC2.vti/'
        await reader.setUrl(url, { loadData: true });
        const vtkImage = reader.getOutputData();
        // Now call your existing setup function with the vtkImage
        setupView(viewRef.current, vtkImage);
      } catch (err) {
        console.error('Failed to load VTK dataset:', err);
      }
    };

    //Initialize and draw image
    init();
    //initExample();


    // Cleanup function to avoid setting state after unmount
    return () => {
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
