import { baseApi } from "./baseApi";
import { db } from "@/db/dexie";
import type { Product, ProductInsert, ProductUpdate } from "./types";

export const productsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listProducts: build.query<Product[], void>({
      query: () => "/products/",
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: "Product" as const, id })), { type: "Product", id: "LIST" }]
          : [{ type: "Product", id: "LIST" }],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.length) await db.products.bulkPut(data);
        } catch { /* offline or request failed — keep whatever is already cached */ }
      },
    }),
    createProduct: build.mutation<Product, ProductInsert>({
      query: (body) => ({ url: "/products/", method: "POST", body }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),
    updateProduct: build.mutation<Product, { id: string; body: ProductUpdate }>({
      query: ({ id, body }) => ({ url: `/products/${id}/`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Product", id }, { type: "Product", id: "LIST" }],
    }),
    deleteProduct: build.mutation<void, string>({
      query: (id) => ({ url: `/products/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),
  }),
});

export const {
  useListProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} = productsApi;
