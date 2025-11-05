// /home/kulvaitv/BIG/git/viv-ambcat/sites/ambivator/src/components/VTK/VtkViewer2DController.tsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import VtkViewer2DPanel from "./VtkViewer2DPanel";
import VtkViewer2DViewport from "./VtkViewer2DViewport";

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

  // derived dimensions (lowercase names as requested)
  const [dims, setDims] = useState<{
    dimx: number;
    dimy: number;
    dimz: number;
  } | null>(null);
  const [multiRes, setMultiRes] = useState(false);
  const [frameIndex, setFrameIndex] = useState<number>(0); // NEW state for current frame index
  const [initialFrameIndex, setInitialFrameIndex] = useState<number>(0); // Initial frame index derived from loader

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
    if (!loader) {
      console.warn("No loader provided");
      setDims(null);
      setMultiRes(false);
      return;
    }

    const extractShape = (obj: any) => {
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
    };

    let shape: any;
    if (Array.isArray(loader)) {
      setMultiRes(true);
      shape = extractShape(loader[0]);
    } else {
      setMultiRes(false);
      shape = extractShape(loader);
    }

    if (!shape) {
      console.warn("Shape not available on loader");
      setDims(null);
      setFrameIndex(0); // Reset frame index if shape is unavailable
      return;
    }

    let midFrameIndex: number = 0;

    if (Array.isArray(shape)) {
      // Expect [z, y, x]. Handle 2D as [y, x].
      if (shape.length >= 3) {
        const [z, y, x] = shape;
        setDims({ dimx: x, dimy: y, dimz: z });
        if (z > 2) {
          midFrameIndex = Math.floor((z - 1) / 2);
        } else {
          midFrameIndex = 0;
        }
      } else if (shape.length === 2) {
        const [y, x] = shape;
        setDims({ dimx: x, dimy: y, dimz: 1 });
        midFrameIndex = 0;
      } else {
        console.warn("Unexpected shape length:", shape);
        setDims(null);
        midFrameIndex = 0;
      }
    } else {
      console.warn("Shape is not an array:", shape);
      setDims(null);
      midFrameIndex = 0;
    }
    setInitialFrameIndex(midFrameIndex);
    setFrameIndex(midFrameIndex);
  }, [loader]);

  const handlePanelToggle = (checked: boolean) => {
    setPanelVisible(checked);
    onPanelVisibilityChange?.(checked);
  };

  const frameCount = dims?.dimz ?? 0;

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
            frameCount={frameCount}
            initialFrameIndex={initialFrameIndex}
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
          frameCount={frameCount} // already present
          initialFrameIndex={initialFrameIndex} // NEW
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