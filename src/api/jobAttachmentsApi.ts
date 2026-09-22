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
  }),
});

export const { useListJobAttachmentsQuery } = jobAttachmentsApi;
