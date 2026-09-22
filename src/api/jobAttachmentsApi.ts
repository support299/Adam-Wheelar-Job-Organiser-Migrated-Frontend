import { baseApi } from "./baseApi";

export type JobAttachment = {
  id: number;
  job: string;
  /** Link to the file in the GHL media library. */
  url: string;
  name: string;
  created_at: string;
};

const listTag = (jobId: string) => ({ type: "JobAttachment" as const, id: `LIST-${jobId}` });

export const jobAttachmentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listJobAttachments: build.query<JobAttachment[], string>({
      query: (jobId) => `/jobs/attachments/?job=${encodeURIComponent(jobId)}`,
      providesTags: (result, _e, jobId) =>
        result
          ? [...result.map((a) => ({ type: "JobAttachment" as const, id: a.id })), listTag(jobId)]
          : [listTag(jobId)],
    }),
    // Uploads the file to GHL's media library and records the returned url
    // against the job (see apps.ghl.views.GhlUploadFileView on the backend).
    uploadJobAttachment: build.mutation<JobAttachment, { job: string; file: File }>({
      query: ({ job, file }) => {
        const body = new FormData();
        body.append("job_id", job);
        body.append("name", file.name);
        body.append("file", file);
        return { url: "/ghl/upload-file/", method: "POST", body };
      },
      invalidatesTags: (_r, _e, { job }) => [listTag(job)],
    }),
  }),
});

export const { useListJobAttachmentsQuery, useUploadJobAttachmentMutation } = jobAttachmentsApi;
