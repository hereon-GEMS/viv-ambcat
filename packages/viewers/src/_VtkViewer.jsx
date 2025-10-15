import React, { useEffect, useRef } from "react";
import vtkRenderWindow from "@kitware/vtk.js/Rendering/Core/RenderWindow";
import vtkRenderer from "@kitware/vtk.js/Rendering/Core/Renderer";
import vtkOpenGLRenderWindow from "@kitware/vtk.js/Rendering/OpenGL/RenderWindow";
import vtkRenderWindowInteractor from "@kitware/vtk.js/Rendering/Core/RenderWindowInteractor";
import vtkImageMapper from "@kitware/vtk.js/Rendering/Core/ImageMapper";
import vtkImageSlice from "@kitware/vtk.js/Rendering/Core/ImageSlice";
import vtkImageData from "@kitware/vtk.js/Common/DataModel/ImageData";

function pixelSourceToVtkImageData({ width, height, data }) {
  const imageData = vtkImageData.newInstance();
  console.log("pixelSourceToVtkImageData", width, height, data);
  imageData.setDimensions(width, height, 1);
  imageData.getPointData().setScalars({
    data: data,
    numberOfComponents: 1,
  });
  return imageData;
}

export default function VtkViewer({
  loader,
  selection,
  width = 1024,
  height = 512,
  zoomLock = true,
  panLock = true,
}) {
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    let leftInteractor, rightInteractor;

    const setupView = async (container, imageData, syncCamera) => {
      const renderWindow = vtkRenderWindow.newInstance();
      const renderer = vtkRenderer.newInstance({ background: [0, 0, 0] });
      const openGLRenderWindow = vtkOpenGLRenderWindow.newInstance();
      openGLRenderWindow.setContainer(container);
      openGLRenderWindow.setSize(width / 2, height);

      renderWindow.addRenderer(renderer);
      renderWindow.addView(openGLRenderWindow);

      const mapper = vtkImageMapper.newInstance();
      mapper.setInputData(imageData);
      mapper.setSlicingMode(2); // Z slice

      const actor = vtkImageSlice.newInstance();
      actor.setMapper(mapper);
      renderer.addActor(actor);
      renderer.resetCamera();

      const interactor = vtkRenderWindowInteractor.newInstance();
      interactor.setView(openGLRenderWindow);
      interactor.initialize();
      interactor.bindEvents(container);

      if (syncCamera) {
        const camera = renderer.getActiveCamera();
        camera.onModified(() => {
          syncCamera.setPosition(...camera.getPosition());
          syncCamera.setFocalPoint(...camera.getFocalPoint());
          syncCamera.setViewUp(...camera.getViewUp());
          syncCamera.modified();
        });
      }

      renderWindow.render();
      return { renderWindow, renderer, interactor };
    };

    const init = async () => {
      const raster = await (
        Array.isArray(loader) ? loader[0] : loader
      ).getRaster({ selection });
      const vtkImage = pixelSourceToVtkImageData(raster);

      // Set up left renderer
      const { renderer: leftRenderer } = await setupView(
        leftRef.current,
        vtkImage,
      );

      // Set up right renderer, sync camera to left
      await setupView(
        rightRef.current,
        vtkImage,
        leftRenderer.getActiveCamera(),
      );
    };

    init();

    return () => {
      // clean up interactors if needed
    };
  }, [loader, selection, width, height, zoomLock, panLock]);

  return (
    <div style={{ display: "flex" }}>
      <div ref={leftRef} style={{ width: width / 2, height }} />
      <div ref={rightRef} style={{ width: width / 2, height }} />
    </div>
  );
}
