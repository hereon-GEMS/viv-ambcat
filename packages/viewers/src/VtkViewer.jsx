import React, { useEffect, useRef, useState } from "react";
import vtkRenderWindow from "@kitware/vtk.js/Rendering/Core/RenderWindow";
import vtkRenderer from "@kitware/vtk.js/Rendering/Core/Renderer";
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";
import vtkOpenGLRenderWindow from "@kitware/vtk.js/Rendering/OpenGL/RenderWindow";
import vtkRenderWindowInteractor from "@kitware/vtk.js/Rendering/Core/RenderWindowInteractor";
import vtkSphereSource from "@kitware/vtk.js/Filters/Sources/SphereSource";
import vtkPolyDataMapper from "@kitware/vtk.js/Rendering/OpenGL/PolyDataMapper";
import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";
import "@kitware/vtk.js/Rendering/Profiles/Geometry";

export default function VtkViewer({ width = 1024, height = 512 }) {
  const viewRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(width);
  const [containerHeight, setContainerHeight] = useState(height);

  useEffect(() => {
    const handleResize = () => {
      if (viewRef.current) {
        setContainerWidth(viewRef.current.clientWidth);
        setContainerHeight(viewRef.current.clientHeight);
      }
    };

    // Resize observer to adjust the size when container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    if (viewRef.current) {
      resizeObserver.observe(viewRef.current);
    }

    // Cleanup on component unmount
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    // Step 2: Ensure viewRef.current is not null
    if (!viewRef.current) {
      console.error("viewRef.current is null");
      return;
    }
    // This function sets up the VTK view with a simple sphere
    const setupView = (container) => {
      // Create the render window
      const renderWindow = vtkRenderWindow.newInstance();
      const renderer = vtkRenderer.newInstance();
      renderer.setBackground(0.1, 0.2, 0.4); // Set background color
      renderWindow.addRenderer(renderer);

      const openGLRenderWindow = vtkOpenGLRenderWindow.newInstance();
      openGLRenderWindow.setContainer(container);
      openGLRenderWindow.setSize(containerWidth, containerHeight);
      renderWindow.addView(openGLRenderWindow);

      // Create an interactor to handle events (like mouse control)
      const interactor = vtkRenderWindowInteractor.newInstance();
      interactor.setView(openGLRenderWindow);
      interactor.initialize();
      interactor.bindEvents(container);

      // Create a simple sphere using vtkSphereSource
      const sphereSource = vtkSphereSource.newInstance();
      sphereSource.setRadius(0.5);
      sphereSource.setPhiResolution(30); // Latitude resolution
      sphereSource.setThetaResolution(30); // Longitude resolution

      // Create a mapper and set its input connection
      const sphereMapper = vtkMapper.newInstance();

      // Create an actor and set the mapper
      const sphereActor = vtkActor.newInstance();
      sphereActor.setMapper(sphereMapper);
      sphereMapper.setInputConnection(sphereSource.getOutputPort()); // Use getOutputData() instead of getOutputPort()
      sphereActor.getProperty().setColor(1.0, 0.3882, 0.2784); // Set sphere color

      // Add the actor to the renderer
      renderer.addActor(sphereActor);

      // Render the scene
      renderWindow.render();
      console.log("VtkViewer is mounted");
    };

    // Set up the VTK view
    setupView(viewRef.current);

    // Cleanup when the component is unmounted
    return () => {
      // If necessary, clean up resources
    };
  }, [width, height]);

  return <div ref={viewRef} style={{ width: "100%", height: "100%" }} />;
}
