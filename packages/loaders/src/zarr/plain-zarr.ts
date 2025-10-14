import type { ZarrArray } from "zarr";
import { fromString } from "../omexml";
import {
  guessBioformatsLabels,
  guessTileSize,
  loadMultiscales,
} from "./lib/utils";
import ZarrPixelSource from "./pixel-source";

export async function load(root: ZarrArray["store"]) {
  let xmlSourceText: string;

  // Step 3: Load multiscale data from Zarr
  const { data } = root;

  // Step 4: Handle labels
  const labels = ["t", "c", "z", "y", "x"];

  // Step 5: Guess tile size or use default
  const tileSize = guessTileSize(data[0]);

  // Step 6: Create pyramid from data
  const pyramid = [new ZarrPixelSource(arr, labels, tileSize)];

  // Step 7: Return data and metadata (or defaults if no metadata is available)
  const metadata = {
    Pixels: {
      Channels: [
        {
          Name: "Channel 1", // Hardcoded single channel name
          SamplesPerPixel: 1,
        },
      ],
    },
  };

  // Step 7: Return data and metadata (or defaults if metadata was not available)
  return {
    data: pyramid,
    metadata: metadata,
  };
}
