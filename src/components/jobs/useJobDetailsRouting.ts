import { useState } from "react";
import type { Job } from "@/api/types";

/**
 * Routes "open this job" to the right editor: a shop-time job (service_type
 * "workshop") gets the lean AddShopTimeDialog, everything else falls through
 * to the caller's normal contact-details opener. Share this across every
 * screen that lists jobs (Daily Planner, contact pages, Saved Plans, Reports)
 * so a shop-time entry never opens the full contact-details view.
 */
export function useJobDetailsRouting(openContactDetails: (job: Job) => void) {
  const [shopOpen, setShopOpen] = useState(false);
  const [editingShopJob, setEditingShopJob] = useState<Job | null>(null);

  function openJobDetails(job: Job) {
    if (job.service_type === "workshop") {
      setEditingShopJob(job);
      setShopOpen(true);
    } else {
      openContactDetails(job);
    }
  }

  /** Open the dialog in create mode (e.g. an "Add shop" button). */
  function openNewShop() {
    setEditingShopJob(null);
    setShopOpen(true);
  }

  function onShopOpenChange(open: boolean) {
    setShopOpen(open);
    if (!open) setEditingShopJob(null);
  }

  return { shopOpen, editingShopJob, openJobDetails, openNewShop, onShopOpenChange };
}
