import { useState, useEffect } from "react";

export function useEditableBlock<T>(
  docRef: string,
  blockId: string,
  initialData: T,
  currentHash: string,
  opts?: { onFinalizeSuccess?: () => void },
) {
  const localStorageKey = `blocksmith:draft:${docRef}:${blockId}`;

  const [isEditing, setIsEditing] = useState(false);
  const [draftData, setDraftData] = useState<T | null>(null);
  const [baseContentHash, setBaseContentHash] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load draft on mount/update
  useEffect(() => {
    try {
      const raw = localStorage.getItem(localStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setDraftData(parsed.updatedData);
        setBaseContentHash(parsed.baseContentHash);

        // If currentHash changed since we created the draft, we have a conflict!
        if (parsed.baseContentHash && parsed.baseContentHash !== currentHash) {
          setHasConflict(true);
        } else {
          setHasConflict(false);
        }
      } else {
        setDraftData(null);
        setBaseContentHash(null);
        setHasConflict(false);
      }
    } catch {
      // Ignore
    }
  }, [localStorageKey, currentHash]);

  const saveDraft = (data: T) => {
    // If we don't have a base content hash set yet, set it to the current hash
    const hash = baseContentHash || currentHash;
    const payload = {
      updatedData: data,
      baseContentHash: hash,
    };
    localStorage.setItem(localStorageKey, JSON.stringify(payload));
    setDraftData(data);
    setBaseContentHash(hash);
    setHasConflict(false);
    setError(null);
    setIsEditing(false);
  };

  const discardDraft = () => {
    localStorage.removeItem(localStorageKey);
    setDraftData(null);
    setBaseContentHash(null);
    setHasConflict(false);
    setError(null);
    setIsEditing(false);
  };

  const finalize = async (force = false): Promise<boolean> => {
    const dataToSubmit = draftData !== null ? draftData : initialData;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/wiki/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: docRef,
          blockId,
          updatedData: dataToSubmit,
          baseContentHash: force ? undefined : (baseContentHash || currentHash),
          force,
        }),
      });

      const data = await res.json();
      if (res.status === 409) {
        setHasConflict(true);
        setError("Conflict: The document has been updated in the IDE since your edits started.");
        return false;
      }

      if (!res.ok) {
        throw new Error(data.error || "Finalize failed");
      }

      if (data.stagingError) {
        setError(
          `Document saved, but staging failed: ${data.stagingError}. ` +
            "Ask your admin to run supabase/schema-registry.sql in Supabase.",
        );
        return false;
      }

      // Success! Clear local storage
      localStorage.removeItem(localStorageKey);
      setDraftData(null);
      setBaseContentHash(null);
      setHasConflict(false);
      setIsEditing(false);
      setSuccess(
        data.stagedVersion
          ? `Saved to staging (v${data.stagedVersion}). Open Pipeline to promote.`
          : "Saved to staging. Open Pipeline to promote.",
      );
      window.setTimeout(() => setSuccess(null), 10_000);
      // Tell release strips/Pipeline widgets a draft just landed in staging.
      window.dispatchEvent(
        new CustomEvent("blocksmith:staged", { detail: { docRef, blockId } }),
      );
      opts?.onFinalizeSuccess?.();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Finalize failed";
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const currentData = draftData !== null ? draftData : initialData;
  const hasDraft = draftData !== null;

  return {
    isEditing,
    setIsEditing,
    draftData,
    currentData,
    hasDraft,
    hasConflict,
    error,
    success,
    loading,
    saveDraft,
    discardDraft,
    finalize,
    setHasConflict,
  };
}
