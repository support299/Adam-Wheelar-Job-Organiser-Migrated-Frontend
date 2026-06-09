import { baseApi } from "./baseApi";

type LatLng = { lat: number; lng: number };

export type RouteMatrix = {
  distance: number[][];
  duration: number[][];
};

export const mapsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDistanceMatrix: build.mutation<RouteMatrix, { points: LatLng[] }>({
      query: (body) => ({ url: "/maps/distance-matrix/", method: "POST", body }),
    }),
    getPolyline: build.mutation<
      { encoded_polyline: string },
      { origin: LatLng; destination: LatLng; waypoints?: LatLng[] }
    >({
      query: (body) => ({ url: "/maps/polyline/", method: "POST", body }),
    }),
  }),
});

export const { useGetDistanceMatrixMutation, useGetPolylineMutation } = mapsApi;
