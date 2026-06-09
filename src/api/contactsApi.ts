import { baseApi } from "./baseApi";
import type { GhlContact, GhlUser, ContactNote } from "./types";

export const contactsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listGhlContacts: build.query<GhlContact[], void>({
      query: () => "/contacts/ghl/",
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: "Contact" as const, id })), { type: "Contact", id: "LIST" }]
          : [{ type: "Contact", id: "LIST" }],
    }),
    listGhlUsers: build.query<GhlUser[], void>({
      query: () => "/contacts/ghl-users/",
      providesTags: [{ type: "GhlUser", id: "LIST" }],
    }),
    listContactNotes: build.query<ContactNote[], string>({
      query: (contactKey) => `/contacts/notes/?contact_key=${encodeURIComponent(contactKey)}`,
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: "ContactNote" as const, id })), { type: "ContactNote", id: "LIST" }]
          : [{ type: "ContactNote", id: "LIST" }],
    }),
    createContactNote: build.mutation<ContactNote, { contact_key: string; job_id?: string; note: string }>({
      query: (body) => ({ url: "/contacts/notes/", method: "POST", body }),
      invalidatesTags: [{ type: "ContactNote", id: "LIST" }],
    }),
    updateContactNote: build.mutation<ContactNote, { id: string; body: { note: string } }>({
      query: ({ id, body }) => ({ url: `/contacts/notes/${id}/`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "ContactNote", id }, { type: "ContactNote", id: "LIST" }],
    }),
    deleteContactNote: build.mutation<void, string>({
      query: (id) => ({ url: `/contacts/notes/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "ContactNote", id: "LIST" }],
    }),
  }),
});

export const {
  useListGhlContactsQuery,
  useListGhlUsersQuery,
  useListContactNotesQuery,
  useCreateContactNoteMutation,
  useUpdateContactNoteMutation,
  useDeleteContactNoteMutation,
} = contactsApi;
