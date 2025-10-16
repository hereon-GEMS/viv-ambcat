import React, { useEffect, useRef, useState } from "react";

// Logic inspired by https://kitware.github.io/vtk-js/examples/PaintWidget.html

import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import vtkImageData from "@kitware/vtk.js/Common/DataModel/ImageData";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkWidgetManager from '@kitware/vtk.js/Widgets/Core/WidgetManager';
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

      const scene = sceneRef.current;
      console.log("scene:", scene);
      console.log("vtk_imageData:", vtk_imageData);

      scene.image = {
        imageMapper: vtkImageMapper.newInstance(),
        actor: vtkImageSlice.newInstance(),
      };

      // background image pipeline
      scene.image.actor.setMapper(scene.image.imageMapper);

      // Trying to configure color transfer function and piecewiseFunction ... but does not work without it as well (black to white)
      const range = vtk_imageData.getPointData().getScalars().getRange();
      const imageProp = scene.image.actor.getProperty();
      const ctf = vtkColorTransferFunction.newInstance();
      ctf.addRGBPoint(0, 0.0, 0.0, 0.0);
      ctf.addRGBPoint(255, 1.0, 1.0, 1.0);
      const pf = vtkPiecewiseFunction.newInstance();
      pf.addPoint(range[0], 1.0);
      pf.addPoint(range[1], 1.0);
      
      imageProp.setRGBTransferFunction(0, ctf);
      imageProp.setScalarOpacity(0, pf);
      imageProp.setUseLookupTableScalarRange(true);
      // End playing with transfer functions

      scene.image.imageMapper.setInputData(vtk_imageData);

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
        zLength: 10,
        center: [0, 0, 0],
      });
      const cubeMapper = vtkMapper.newInstance();
      cubeMapper.setInputConnection(cubeSource.getOutputPort());
      const cubeActor = vtkActor.newInstance();
      cubeActor.setMapper(cubeMapper);
      
      
      scene.renderer.addActor(cubeActor);
      // Cube shows up but not 2D image
      scene.renderWindow.render();


      // Extensive logging start
      const scalars = vtk_imageData.getPointData().getScalars();
      const values = scalars.getData();

      console.log("Scalars:", scalars);
      console.log("Values:", values);
      console.log(`Data range: [${range[0]}, ${range[1]}]`);
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
    //init();
    initExample();


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
