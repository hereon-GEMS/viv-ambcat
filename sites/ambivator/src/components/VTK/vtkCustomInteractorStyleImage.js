// vtkCustomInteractorStyleImage.js
import macros from "@kitware/vtk.js/macros";
import vtk from "@kitware/vtk.js/vtk";
import vtkInteractorStyleImage from "@kitware/vtk.js/Interaction/Style/InteractorStyleImage";

// ----------------------------------------------------------------------------
// Custom InteractorStyleImage
// ----------------------------------------------------------------------------
function vtkCustomInteractorStyleImage(publicAPI, model) {
  // Add our class name
  model.classHierarchy.push("vtkCustomInteractorStyleImage");

  // Capture "parentClass" api for internal use
  const superClass = Object.assign({}, publicAPI);

  // Save the original wheel handler
  const superHandleMouseWheel = publicAPI.handleMouseWheel;

  // Override wheel handler
  publicAPI.handleMouseWheel = (callData) => {
    const dyf = 1 - callData.spinY / model.zoomFactor;
    publicAPI.dollyByFactor(model.getRenderer(callData), dyf);
  };

  //--------------------------------------------------------------------------
  publicAPI.handleStartMouseWheel = (callData) => {
    publicAPI.startDolly();
  };

  //--------------------------------------------------------------------------
  publicAPI.handleEndMouseWheel = (callData) => {
    publicAPI.endDolly();
  };
}

const DEFAULT_VALUES = {};

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inherit from vtkInteractorStyleImage
  vtkInteractorStyleImage.extend(publicAPI, model, initialValues);

  vtkCustomInteractorStyleImage(publicAPI, model);
}

export const newInstance = macros.newInstance(
  extend,
  "vtkCustomInteractorStyleImage",
);
export default { newInstance, extend };
