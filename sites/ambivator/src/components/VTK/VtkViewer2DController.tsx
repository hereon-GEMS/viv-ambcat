// /home/kulvaitv/BIG/git/viv-ambcat/sites/ambivator/src/components/VTK/VtkViewer2DController.tsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import VtkViewer2DPanel from "./VtkViewer2DPanel";
import VtkViewer2DViewport from "./VtkViewer2DViewport";
import { set } from "@kitware/vtk.js/macros";

export interface VtkViewer2DControllerProps {
  loader: any;
  selection: any;
  width?: number;
  height?: number;
  debug?: boolean;
  controlPanelVisible?: boolean;
  controlPanelSide?: "left" | "right";
  onPanelVisibilityChange?: (visible: boolean) => void;
  onReady?: () => void;
}

export interface LoaderContext {
  loader: any;
  dims: { dimx: number; dimy: number; dimz: number } | null;
  frameCount: number;
  multiRes: boolean;
  multiResLevelCount: number;
  midFrameIndex: number;
}

// helper to extract shape from loader
function extractShape(obj: any): number[] | undefined {
  if (!obj) return undefined;
  let s = obj.shape;
  if (typeof s === "function") {
    try {
      s = s();
    } catch (e) {
      console.warn("Error calling shape():", e);
      s = undefined;
    }
  }
  return s;
}

// --- helper to build LoaderContext from loader ---
export function buildLoaderContext(loader: any): LoaderContext {
    let context: LoaderContext | null = {loader: loader, dims: null, frameCount: 0, multiRes: false, multiResLevelCount: 1, midFrameIndex: 0};
    if (!loader) {
      return context;
    }
    let shape: any;
    if (Array.isArray(loader)) {
      context.multiRes = true;
      context.multiResLevelCount = loader.length;
      shape = extractShape(loader[0]);
    } else {
        context.multiRes = false;
        context.multiResLevelCount = 1;
        shape = extractShape(loader);
    }
    if(shape.length === 2) {
        const [y, x] = shape;
        context.dims = {dimx: x, dimy: y, dimz: 1};
        context.midFrameIndex = 0;
    }else if(shape.length === 3) {
        const [z, y, x] = shape;
        context.dims = {dimx: x, dimy: y, dimz: z};
        context.midFrameIndex = Math.floor((z - 1) / 2);
    }
    if(context.dims)
    {
        context.frameCount = context.dims.dimz;
    }else{
        context.frameCount = 0;
    }
    return context;
}


const VtkViewer2DController: React.FC<VtkViewer2DControllerProps> = ({
  loader,
  selection,
  width = 1024,
  height = 512,
  debug = false,
  controlPanelVisible = false,
  controlPanelSide = "left",
  onPanelVisibilityChange,
  onReady,
}) => {
  const baseDivRef = useRef<HTMLDivElement>(null);
  const viewportDivRef = useRef<HTMLDivElement>(null);
  const controlPanelDivRef = useRef<HTMLDivElement>(null);

  const [panelVisible, setPanelVisible] = useState(controlPanelVisible);
  const [panelSide, setPanelSide] = useState<"left" | "right">(
    controlPanelSide,
  );
  const context = buildLoaderContext(loader);
  const [loaderContext, setLoaderContext] = useState<LoaderContext | null>(context);
 

  const [frameIndex, setFrameIndex] = useState<number>(context.midFrameIndex); // NEW state for current frame index

  // stable callback so Panel does not re-render when frameIndex changes
  const handleFrameIndexUpdate = useCallback(
    (v: number) => {
      setFrameIndex(v);
      // Safely call readFrame if the ref is set and method exists
      viewportDivRef.current?.readFrame(v);
      /*
    const el = viewportDivRef.current as any;
    if (el && typeof el.readFrame === "function") {
      el.readFrame(v); // imperatively update viewport
    }*/
    },
    [viewportDivRef],
  );

  useEffect(() => {
    setPanelVisible(controlPanelVisible);
  }, [controlPanelVisible]);

  useEffect(() => {
    setPanelSide(controlPanelSide);
  }, [controlPanelSide]);

  // derive dimx, dimy, dimz from loader only (not props)
  useEffect(() => {
    const context = buildLoaderContext(loader);
    setLoaderContext(context);
    setFrameIndex(context.midFrameIndex);
  }, [loader]);

  const handlePanelToggle = (checked: boolean) => {
    setPanelVisible(checked);
    onPanelVisibilityChange?.(checked);
  };

if (!loaderContext || loaderContext.frameCount === 0) {
  return <div>Loading...</div>;
}

  return (
    <div
      ref={baseDivRef}
      className="flex-1 h-full w-full"
      style={{
        border: debug ? "5px solid red" : "none",
        minWidth: width,
        minHeight: height,
      }}
    >
      <div
        className={`drawer drawer-open ${panelSide === "right" ? "drawer-end" : ""}`}
      >
        <input
          id="control-panel-drawer"
          type="checkbox"
          className="drawer-toggle"
          defaultChecked={panelVisible}
          onChange={(e) => handlePanelToggle(e.target.checked)}
        />
        <div className="drawer-content">
          <VtkViewer2DViewport
            ref={viewportDivRef} // FIX
            loader={loader}
            frameCount={loaderContext.frameCount}
            initialFrameIndex={loaderContext.midFrameIndex}
            selection={selection}
            width={width}
            height={height}
            onReady={onReady}
            debug={debug}
          />
        </div>
        <VtkViewer2DPanel
          ref={controlPanelDivRef}
          toggleInputId="control-panel-drawer"
          frameCount={loaderContext.frameCount} // already present
          initialFrameIndex={loaderContext.midFrameIndex} // NEW
          onFrameIndexUpdate={handleFrameIndexUpdate} // NEW callback
          debug={debug}
        />
      </div>
    </div>
  );
};

export default VtkViewer2DController;



/*

 // NEW: react to frameIndex changes
    const latestTaskRef = useRef<symbol | null>(null);
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
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            if (pendingFrameRef.current !== null && frameIndex === pendingFrameRef.current && !cancelled) {
              loadAndDisplayImage(pendingFrameRef.current);
            }
            if (frameIndex === pendingFrameRef.current) {
              pendingFrameRef.current = null;
            }
          }, 200);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [frameIndex, frameCount, loader, selection]);

    const loadAndDisplayImage = async (index: number) => {
      if (!loader) {
        console.warn("No loader provided");
        return;
      }
      if (frameCount <= 0) return;
      if (index < 0 || index >= frameCount) return;
      if (index === displayedFrameId) return; // already displayed

      const taskId = Symbol();
      latestTaskRef.current = taskId;
      loadingTasksRef.current.add(taskId);

      try {
        const raster = await (
          Array.isArray(loader) ? loader[0] : loader
        ).getRaster({ selection: selection || { z: index } });
        const vtkImage = pixelSourceToVtkImageData(raster);

        // Update the image in the existing pipeline
        const scene = vtkObjectsRef.current;
        if (scene.image.mapper && scene.renderWindow) {
          updateImageRef(imageRef, vtkImage);
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
        }
      } catch (error) {
        console.error(
          `Error loading or displaying image frame ${index}:`,
          error,
        );
      } finally {
        loadingTasksRef.current.delete(taskId);
        if (latestTaskRef.current === taskId) {
          latestTaskRef.current = null;
        }
  
      }
    };

*/