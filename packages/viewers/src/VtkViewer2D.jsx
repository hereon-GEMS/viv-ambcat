import React, { useEffect, useRef, useState } from "react";
import vtkRenderWindow from "@kitware/vtk.js/Rendering/Core/RenderWindow";
import vtkRenderer from "@kitware/vtk.js/Rendering/Core/Renderer";
import vtkOpenGLRenderWindow from "@kitware/vtk.js/Rendering/OpenGL/RenderWindow";
import vtkRenderWindowInteractor from "@kitware/vtk.js/Rendering/Core/RenderWindowInteractor";
import vtkImageMapper from "@kitware/vtk.js/Rendering/Core/ImageMapper";
import vtkImageSlice from "@kitware/vtk.js/Rendering/Core/ImageSlice";
import vtkImageData from "@kitware/vtk.js/Common/DataModel/ImageData";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";
import "@kitware/vtk.js/Rendering/Profiles/Geometry";

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
  imageData.setSpacing([1, 1, 1]);
  imageData.setOrigin([0, 0, 0]);
  imageData.setDimensions(width, height, 1);
  imageData.getPointData().setScalars(scalars);
  return imageData;
}

export default function VtkViewer({
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
  });

  const [containerWidth, setContainerWidth] = useState(width);
  const [containerHeight, setContainerHeight] = useState(height);

  useEffect(() => {
    const handleResize = () => {
      if (viewRef.current) {
        setContainerWidth(viewRef.current.clientWidth);
        setContainerHeight(
          Math.min(window.innerHeight, viewRef.current.clientHeight),
        );
      }
    };

    // Resize observer to adjust the size when container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    if (viewRef.current) {
      resizeObserver.observe(viewRef.current);
    }

    // Properly handle shrink
    window.addEventListener("resize", handleResize);

    // Cleanup on component unmount
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    // Ensure viewRef.current is not null
    if (!viewRef.current) {
      console.error("viewRef.current is null");
      return;
    }

    const setupView = async (viewContainer, vtk_imageData) => {
      if (!vtkObjectsRef.current.renderWindow) {
        vtkObjectsRef.current.renderWindow = vtkRenderWindow.newInstance();
        vtkObjectsRef.current.renderer = vtkRenderer.newInstance({
          background: [0.1, 0.2, 0.3],
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
        vtkObjectsRef.current.mapper.setSlicingMode(2); // Z slice

        //Create an actor to represent the image
        //DIFFERENT actor is now  vtkImageSlice not vtkActor
        vtkObjectsRef.current.actor = vtkImageSlice.newInstance();
        vtkObjectsRef.current.actor.setMapper(vtkObjectsRef.current.mapper);

        //Add the actor to the renderer
        vtkObjectsRef.current.renderer.addActor(vtkObjectsRef.current.actor);
        vtkObjectsRef.current.renderer.resetCamera();

        //Render the scene
        vtkObjectsRef.current.renderWindow.render();
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
      const vtkImage = pixelSourceToVtkImageData(raster);

      // Set up left renderer
      await setupView(viewRef.current, vtkImage);
    };

    init();

    return () => {
      // clean up interactors if needed
    };
  }, [loader, selection, width, height, zoomLock, panLock]);

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
