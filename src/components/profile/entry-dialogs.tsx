"use client";

import { useActionState, useId, useState } from "react";
import { LuCheck, LuCornerDownRight, LuFlag, LuInfo, LuMessageSquare, LuTrash2 } from "react-icons/lu";
import { replyAction, reportAction } from "@/app/player/[name]/actions";
import { REPLY_MAX, REPORT_CATEGORIES, REPORT_DETAILS_MAX, type ReportCategory } from "@/lib/rules";
import { buttonPrimary, buttonSecondary, Counter, Dialog, DialogFooter, DialogHeader, EntryCard, ErrorNote, textareaClass } from "./dialog";
import { IDLE, type ActionResult, type EntryView } from "./types";

/** Write, edit or delete the viewer's Reply on a +1/−1 they received. */
export function ReplyDialog({ entry, viewerName, onClose }: { entry: EntryView; viewerName: string; onClose: () => void }) {
  const titleId = useId();
  const textId = useId();
  const helpId = useId();
  const editing = !!entry.reply;
  const [text, setText] = useState(entry.reply?.text ?? "");
  const [posted, setPosted] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await replyAction(entry.id, prev, formData);
    if (result.status === "ok") {
      if (result.deleted) onClose();
      else setPosted(result.text ?? text);
    }
    return result;
  }, IDLE);
  const empty = !text.trim();

  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <DialogHeader
        id={titleId}
        title={posted !== null ? "Reply posted" : editing ? "Edit your Reply" : "Write a Reply"}
        onClose={onClose}
        icon={<LuMessageSquare aria-hidden className="size-5 shrink-0 text-accent" />}
      />
      <form action={formAction}>
        <div className="flex flex-col gap-[18px] p-5">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-[0.06em] text-muted uppercase">The Reputation you received</span>
            <EntryCard entry={entry}>
              {posted !== null && (
                <div className="mt-1 flex gap-2.5 rounded border-2 border-line bg-surface px-3 py-2.5">
                  <LuCornerDownRight aria-hidden className="mt-0.5 size-[15px] shrink-0 text-muted" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs text-muted">
                      <strong className="font-semibold text-ink">Reply from {viewerName}</strong> · just now
                    </span>
                    <p className="m-0 text-sm leading-normal text-ink [overflow-wrap:anywhere]">{posted}</p>
                  </div>
                </div>
              )}
            </EntryCard>
          </div>

          {posted === null ? (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={textId} className="text-sm font-bold">
                    Your Reply
                  </label>
                  <span className="inline-flex h-6 items-center rounded-[3px] border border-line-strong bg-surface-3 px-2 text-xs font-semibold text-muted">
                    One Reply per +1 or −1
                  </span>
                </div>
                <textarea
                  id={textId}
                  name="text"
                  rows={4}
                  value={text}
                  maxLength={REPLY_MAX}
                  onChange={(e) => setText(e.target.value.slice(0, REPLY_MAX))}
                  placeholder="Share your side of the story."
                  aria-describedby={helpId}
                  className={textareaClass}
                />
                <div className="flex justify-between gap-3">
                  <span id={helpId} className="text-[13px] leading-[1.45] text-muted">
                    Keep it calm and factual. Everyone who views your profile can read it.
                  </span>
                  <Counter value={text} max={REPLY_MAX} />
                </div>
              </div>
              <div className="flex gap-2.5 rounded border-2 border-line bg-surface-2 px-3.5 py-3 text-[13px] leading-normal text-ink-2">
                <LuInfo aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  Your Reply shows under this Reputation. You get one Reply per +1 or −1, and you can edit or delete it later. A Reply
                  doesn&apos;t change the Reputation: to dispute it, use Report.
                </span>
              </div>
            </>
          ) : (
            <div
              role="status"
              className="flex items-center gap-2.5 rounded border-2 border-pos-line bg-pos-bg px-3.5 py-3 text-sm font-semibold text-[#c9f5d8]"
            >
              <LuCheck aria-hidden className="size-[18px] shrink-0 text-pos" />
              Reply posted. It now shows on your profile.
            </div>
          )}
          <ErrorNote message={state.status === "error" ? state.message : null} />
        </div>

        <DialogFooter>
          {posted === null ? (
            <>
              {editing && (
                <button
                  type="submit"
                  name="intent"
                  value="delete"
                  disabled={pending}
                  className="mr-auto flex h-12 cursor-pointer items-center gap-2 rounded border-2 border-neg-line bg-transparent px-3.5 text-[15px] font-semibold text-neg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LuTrash2 aria-hidden className="size-4" />
                  Delete
                </button>
              )}
              <button type="button" onClick={onClose} className={buttonSecondary}>
                Cancel
              </button>
              <button type="submit" name="intent" value="save" disabled={empty || pending} className={buttonPrimary}>
                {pending ? "Saving…" : editing ? "Save Reply" : "Post Reply"}
              </button>
            </>
          ) : (
            <button type="button" onClick={onClose} className={buttonPrimary}>
              Back to my profile
            </button>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}

const CATEGORY_KEYS = Object.keys(REPORT_CATEGORIES) as ReportCategory[];

/** Ask Staff to review a +1/−1. */
export function ReportDialog({
  entry,
  receiverName,
  isOwn,
  onClose,
}: {
  entry: EntryView;
  receiverName: string;
  isOwn: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const detailsId = useId();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await reportAction(entry.id, prev, formData);
    if (result.status === "ok") setSent(true);
    return result;
  }, IDLE);
  const needsDetails = category === "other";
  const cantSend = category === null || (needsDetails && !details.trim());
  const valueText = entry.value === 1 ? "+1" : "−1";

  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <DialogHeader
        id={titleId}
        title={sent ? "Report sent" : "Report Reputation"}
        onClose={onClose}
        icon={<LuFlag aria-hidden className="size-5 shrink-0 text-accent" />}
      />
      {sent ? (
        <>
          <div role="status" className="flex flex-col items-center gap-3.5 px-6 py-8 text-center">
            <div className="flex size-14 items-center justify-center rounded border-2 border-pos-line bg-pos-bg text-pos">
              <LuCheck aria-hidden className="size-7" />
            </div>
            <h3 className="m-0 font-pixel text-2xl font-bold">Report sent</h3>
            <p className="m-0 max-w-[380px] leading-[1.55] text-ink-2">
              Staff will review the {valueText} from {entry.giver.username}. If it breaks the rules, they&apos;ll remove it and{" "}
              {isOwn ? "your" : `${receiverName}'s`} Net Reputation will update.
            </p>
            <p className="m-0 max-w-[380px] text-[13px] leading-normal text-muted">You can report each +1 or −1 once.</p>
          </div>
          <DialogFooter>
            <button type="button" onClick={onClose} className={buttonPrimary}>
              Done
            </button>
          </DialogFooter>
        </>
      ) : (
        <form action={formAction}>
          <div className="flex flex-col gap-[18px] p-5">
            <EntryCard entry={entry} />

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-2.5 p-0 text-sm font-bold">What&apos;s wrong with this Reputation?</legend>
              <div className="flex flex-col gap-2">
                {CATEGORY_KEYS.map((key) => {
                  const on = category === key;
                  return (
                    <label
                      key={key}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded border-2 px-3.5 py-2.5 text-sm leading-[1.4] ${
                        on ? "border-accent bg-accent-bg" : "border-line-strong bg-surface-2"
                      }`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={key}
                        checked={on}
                        onChange={() => setCategory(key)}
                        required
                        className="m-0 size-[18px] shrink-0 accent-accent"
                      />
                      <span>{REPORT_CATEGORIES[key]}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={detailsId} className="text-sm font-bold">
                  Details for Staff
                </label>
                <span className="text-xs font-semibold text-muted">{needsDetails ? "Required for Something else" : "Optional"}</span>
              </div>
              <textarea
                id={detailsId}
                name="details"
                rows={3}
                value={details}
                maxLength={REPORT_DETAILS_MAX}
                required={needsDetails}
                onChange={(e) => setDetails(e.target.value.slice(0, REPORT_DETAILS_MAX))}
                placeholder="Anything that helps, like when it happened or who was there."
                className={textareaClass}
              />
              <div className="flex justify-end">
                <Counter value={details} max={REPORT_DETAILS_MAX} />
              </div>
            </div>

            <p className="m-0 text-[13px] leading-normal text-muted">
              Staff will review this Reputation. It stays visible while they look. {entry.giver.username} won&apos;t be told who
              reported it.
            </p>
            <ErrorNote message={state.status === "error" ? state.message : null} />
          </div>
          <DialogFooter>
            <button type="button" onClick={onClose} className={buttonSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={cantSend || pending} className={buttonPrimary}>
              {pending ? "Sending…" : "Send Report"}
            </button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
