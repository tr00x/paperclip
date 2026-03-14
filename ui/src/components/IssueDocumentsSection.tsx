import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Issue } from "@paperclipai/shared";
import { issuesApi } from "../api/issues";
import { useAutosaveIndicator } from "../hooks/useAutosaveIndicator";
import { queryKeys } from "../lib/queryKeys";
import { relativeTime } from "../lib/utils";
import { MarkdownBody } from "./MarkdownBody";
import { MarkdownEditor, type MentionOption } from "./MarkdownEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, MoreHorizontal, Plus, Trash2, X } from "lucide-react";

type DraftState = {
  key: string;
  title: string;
  body: string;
  baseRevisionId: string | null;
  isNew: boolean;
};

const DOCUMENT_AUTOSAVE_DEBOUNCE_MS = 900;
const DOCUMENT_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function renderBody(body: string, className?: string) {
  return <MarkdownBody className={className}>{body}</MarkdownBody>;
}

function isPlanKey(key: string) {
  return key.trim().toLowerCase() === "plan";
}

function titlesMatchKey(title: string | null | undefined, key: string) {
  return (title ?? "").trim().toLowerCase() === key.trim().toLowerCase();
}

export function IssueDocumentsSection({
  issue,
  canDeleteDocuments,
  mentions,
  imageUploadHandler,
  extraActions,
}: {
  issue: Issue;
  canDeleteDocuments: boolean;
  mentions?: MentionOption[];
  imageUploadHandler?: (file: File) => Promise<string>;
  extraActions?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [autosaveDocumentKey, setAutosaveDocumentKey] = useState<string | null>(null);
  const autosaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    state: autosaveState,
    markDirty,
    reset,
    runSave,
  } = useAutosaveIndicator();

  const { data: documents } = useQuery({
    queryKey: queryKeys.issues.documents(issue.id),
    queryFn: () => issuesApi.listDocuments(issue.id),
  });

  const invalidateIssueDocuments = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issue.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.documents(issue.id) });
  };

  const upsertDocument = useMutation({
    mutationFn: async (nextDraft: DraftState) =>
      issuesApi.upsertDocument(issue.id, nextDraft.key, {
        title: isPlanKey(nextDraft.key) ? null : nextDraft.title.trim() || null,
        format: "markdown",
        body: nextDraft.body,
        baseRevisionId: nextDraft.baseRevisionId,
      }),
  });

  const deleteDocument = useMutation({
    mutationFn: (key: string) => issuesApi.deleteDocument(issue.id, key),
    onSuccess: () => {
      setError(null);
      setConfirmDeleteKey(null);
      invalidateIssueDocuments();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    },
  });

  const sortedDocuments = useMemo(() => {
    return [...(documents ?? [])].sort((a, b) => {
      if (a.key === "plan" && b.key !== "plan") return -1;
      if (a.key !== "plan" && b.key === "plan") return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [documents]);

  const hasRealPlan = sortedDocuments.some((doc) => doc.key === "plan");
  const isEmpty = sortedDocuments.length === 0 && !issue.legacyPlanDocument;
  const newDocumentKeyError =
    draft?.isNew && draft.key.trim().length > 0 && !DOCUMENT_KEY_PATTERN.test(draft.key.trim())
      ? "Use lowercase letters, numbers, -, or _, and start with a letter or number."
      : null;

  const resetAutosaveState = useCallback(() => {
    setAutosaveDocumentKey(null);
    reset();
  }, [reset]);

  const markDocumentDirty = useCallback((key: string) => {
    setAutosaveDocumentKey(key);
    markDirty();
  }, [markDirty]);

  const beginNewDocument = () => {
    resetAutosaveState();
    setDraft({
      key: "",
      title: "",
      body: "",
      baseRevisionId: null,
      isNew: true,
    });
    setError(null);
  };

  const beginEdit = (key: string) => {
    const doc = sortedDocuments.find((entry) => entry.key === key);
    if (!doc) return;
    resetAutosaveState();
    setDraft({
      key: doc.key,
      title: doc.title ?? "",
      body: doc.body,
      baseRevisionId: doc.latestRevisionId,
      isNew: false,
    });
    setError(null);
  };

  const cancelDraft = () => {
    if (autosaveDebounceRef.current) {
      clearTimeout(autosaveDebounceRef.current);
    }
    resetAutosaveState();
    setDraft(null);
    setError(null);
  };

  const commitDraft = useCallback(async (
    currentDraft: DraftState | null,
    options?: { clearAfterSave?: boolean; trackAutosave?: boolean },
  ) => {
    if (!currentDraft || upsertDocument.isPending) return false;
    const normalizedKey = currentDraft.key.trim().toLowerCase();
    const normalizedBody = currentDraft.body.trim();
    const normalizedTitle = currentDraft.title.trim();

    if (!normalizedKey || !normalizedBody) {
      if (currentDraft.isNew) {
        setError("Document key and body are required");
      } else if (!normalizedBody) {
        setError("Document body cannot be empty");
      }
      if (options?.trackAutosave) {
        resetAutosaveState();
      }
      return false;
    }

    if (!DOCUMENT_KEY_PATTERN.test(normalizedKey)) {
      setError("Document key must start with a letter or number and use only lowercase letters, numbers, -, or _.");
      if (options?.trackAutosave) {
        resetAutosaveState();
      }
      return false;
    }

    const existing = sortedDocuments.find((doc) => doc.key === normalizedKey);
    if (
      !currentDraft.isNew &&
      existing &&
      existing.body === currentDraft.body &&
      (existing.title ?? "") === currentDraft.title
    ) {
      if (options?.clearAfterSave) {
        setDraft((value) => (value?.key === normalizedKey ? null : value));
      }
      if (options?.trackAutosave) {
        resetAutosaveState();
      }
      return true;
    }

    const save = async () => {
      const saved = await upsertDocument.mutateAsync({
        ...currentDraft,
        key: normalizedKey,
        title: isPlanKey(normalizedKey) ? "" : normalizedTitle,
        body: currentDraft.body,
      });
      setError(null);
      setDraft((value) => {
        if (!value || value.key !== normalizedKey) return value;
        if (options?.clearAfterSave) return null;
        return {
          key: saved.key,
          title: saved.title ?? "",
          body: saved.body,
          baseRevisionId: saved.latestRevisionId,
          isNew: false,
        };
      });
      invalidateIssueDocuments();
    };

    try {
      if (options?.trackAutosave) {
        setAutosaveDocumentKey(normalizedKey);
        await runSave(save);
      } else {
        await save();
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save document");
      return false;
    }
  }, [invalidateIssueDocuments, resetAutosaveState, runSave, sortedDocuments, upsertDocument]);

  const handleDraftBlur = async (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (autosaveDebounceRef.current) {
      clearTimeout(autosaveDebounceRef.current);
    }
    await commitDraft(draft, { clearAfterSave: true, trackAutosave: true });
  };

  const handleDraftKeyDown = async (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelDraft();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
      await commitDraft(draft, { clearAfterSave: false, trackAutosave: true });
    }
  };

  useEffect(() => {
    return () => {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!draft || draft.isNew) return;
    const existing = sortedDocuments.find((doc) => doc.key === draft.key);
    if (!existing) return;
    const hasChanges =
      existing.body !== draft.body ||
      (existing.title ?? "") !== draft.title;
    if (!hasChanges) {
      if (autosaveState !== "saved") {
        resetAutosaveState();
      }
      return;
    }
    markDocumentDirty(draft.key);
    if (autosaveDebounceRef.current) {
      clearTimeout(autosaveDebounceRef.current);
    }
    autosaveDebounceRef.current = setTimeout(() => {
      void commitDraft(draft, { clearAfterSave: false, trackAutosave: true });
    }, DOCUMENT_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
    };
  }, [autosaveState, commitDraft, draft, markDocumentDirty, resetAutosaveState, sortedDocuments]);

  const documentBodyShellClassName = "mt-3 overflow-hidden rounded-md";
  const documentBodyPaddingClassName = "";
  const documentBodyContentClassName = "paperclip-edit-in-place-content min-h-[220px] text-[15px] leading-7";

  return (
    <div className="space-y-3">
      {isEmpty && !draft?.isNew ? (
        <div className="flex items-center justify-end gap-2">
          {extraActions}
          <Button variant="outline" size="sm" onClick={beginNewDocument}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New document
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Documents</h3>
          <div className="flex items-center gap-2">
            {extraActions}
            <Button variant="outline" size="sm" onClick={beginNewDocument}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New document
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {draft?.isNew && (
        <div
          className="space-y-3 rounded-lg border border-border bg-accent/10 p-3"
          onBlurCapture={handleDraftBlur}
          onKeyDown={handleDraftKeyDown}
        >
          <Input
            autoFocus
            value={draft.key}
            onChange={(event) =>
              setDraft((current) => current ? { ...current, key: event.target.value.toLowerCase() } : current)
            }
            placeholder="Document key"
          />
          {newDocumentKeyError && (
            <p className="text-xs text-destructive">{newDocumentKeyError}</p>
          )}
          {!isPlanKey(draft.key) && (
            <Input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => current ? { ...current, title: event.target.value } : current)
              }
              placeholder="Optional title"
            />
          )}
          <MarkdownEditor
            value={draft.body}
            onChange={(body) =>
              setDraft((current) => current ? { ...current, body } : current)
            }
            placeholder="Markdown body"
            bordered={false}
            className="bg-transparent"
            contentClassName="min-h-[220px] text-[15px] leading-7"
            mentions={mentions}
            imageUploadHandler={imageUploadHandler}
            onSubmit={() => void commitDraft(draft, { clearAfterSave: false, trackAutosave: false })}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancelDraft}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void commitDraft(draft, { clearAfterSave: false, trackAutosave: false })}
              disabled={upsertDocument.isPending}
            >
              {upsertDocument.isPending ? "Saving..." : "Create document"}
            </Button>
          </div>
        </div>
      )}

      {!hasRealPlan && issue.legacyPlanDocument ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" />
            <span className="rounded-full border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              PLAN
            </span>
          </div>
          <div className={documentBodyPaddingClassName}>
            {renderBody(issue.legacyPlanDocument.body, documentBodyContentClassName)}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {sortedDocuments.map((doc) => {
          const activeDraft = draft?.key === doc.key && !draft.isNew ? draft : null;
          const showTitle = !isPlanKey(doc.key) && !!doc.title?.trim() && !titlesMatchKey(doc.title, doc.key);

          return (
            <div key={doc.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {doc.key}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      rev {doc.latestRevisionNumber} • updated {relativeTime(doc.updatedAt)}
                    </span>
                  </div>
                  {showTitle && <p className="mt-2 text-sm font-medium">{doc.title}</p>}
                </div>
                {canDeleteDocuments && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground"
                        title="Document actions"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setConfirmDeleteKey(doc.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete document
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div
                className="mt-3 space-y-3"
                onFocusCapture={() => {
                  if (!activeDraft) {
                    beginEdit(doc.key);
                  }
                }}
                onBlurCapture={async (event) => {
                  if (activeDraft) {
                    await handleDraftBlur(event);
                  }
                }}
                onKeyDown={async (event) => {
                  if (activeDraft) {
                    await handleDraftKeyDown(event);
                  }
                }}
              >
                {activeDraft && !isPlanKey(doc.key) && (
                  <Input
                    value={activeDraft.title}
                    onChange={(event) => {
                      markDocumentDirty(doc.key);
                      setDraft((current) => current ? { ...current, title: event.target.value } : current);
                    }}
                    placeholder="Optional title"
                  />
                )}
                <div
                  className={`${documentBodyShellClassName} ${documentBodyPaddingClassName} ${
                    activeDraft ? "" : "hover:bg-accent/10"
                  }`}
                >
                  <MarkdownEditor
                    value={activeDraft?.body ?? doc.body}
                    onChange={(body) => {
                      markDocumentDirty(doc.key);
                      setDraft((current) => {
                        if (current && current.key === doc.key && !current.isNew) {
                          return { ...current, body };
                        }
                        return {
                          key: doc.key,
                          title: doc.title ?? "",
                          body,
                          baseRevisionId: doc.latestRevisionId,
                          isNew: false,
                        };
                      });
                    }}
                    placeholder="Markdown body"
                    bordered={false}
                    className="bg-transparent"
                    contentClassName={documentBodyContentClassName}
                    mentions={mentions}
                    imageUploadHandler={imageUploadHandler}
                    onSubmit={() => void commitDraft(activeDraft ?? draft, { clearAfterSave: false, trackAutosave: true })}
                  />
                </div>
                <div className="flex min-h-4 items-center justify-end px-1">
                  <span
                    className={`text-[11px] transition-opacity duration-150 ${
                      autosaveState === "error" ? "text-destructive" : "text-muted-foreground"
                    } ${activeDraft ? "opacity-100" : "opacity-0"}`}
                  >
                    {activeDraft && autosaveDocumentKey === doc.key
                      ? autosaveState === "saving"
                        ? "Autosaving..."
                        : autosaveState === "saved"
                          ? "Saved"
                          : autosaveState === "error"
                            ? "Could not save"
                            : ""
                      : ""}
                  </span>
                </div>
              </div>

              {confirmDeleteKey === doc.key && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive font-medium">
                    Delete this document? This cannot be undone.
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDeleteKey(null)}
                      disabled={deleteDocument.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteDocument.mutate(doc.key)}
                      disabled={deleteDocument.isPending}
                    >
                      {deleteDocument.isPending ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
