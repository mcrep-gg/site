"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { LuBan, LuCheck, LuCircleAlert, LuCircleCheck, LuClock, LuRotateCcw, LuTrash2, LuX } from "react-icons/lu";
import { giveAction, removeAction } from "@/app/player/[name]/actions";
import { ValueChip } from "@/components/reputation";
import { SkinHead } from "@/components/skin-head";
import { DAILY_LIMIT, NEW_PLAYER_DAILY_LIMIT, NEW_PLAYER_DAYS, REASON_MAX, type Value } from "@/lib/rules";
import { buttonPrimary, buttonSecondary, Counter, Dialog, DialogFooter, DialogHeader, ErrorNote, textareaClass } from "./dialog";
import { IDLE, type ActionResult, type GiveContext } from "./types";

const sign = (v: Value) => (v === 1 ? "+1" : "−1");

/** Give, or change, a +1/−1. Shows the daily-limit or Suspension notice instead when the viewer can't give. */
export function GiveDialog({ ctx, initialChoice, onClose }: { ctx: GiveContext; initialChoice: Value; onClose: () => void }) {
  const titleId = useId();
  const isReplace = !!ctx.existing;
  const view = ctx.suspension ? "suspended" : ctx.usedToday >= ctx.limit ? "limit" : "form";
  const title =
    view === "suspended"
      ? "You can't give Reputation"
      : view === "limit"
        ? "Daily limit reached"
        : isReplace
          ? "Change the Reputation you gave"
          : "Give Reputation";

  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <DialogHeader
        id={titleId}
        title={title}
        onClose={onClose}
        icon={<SkinHead uuid={ctx.target.uuid} username={ctx.target.username} size={40} />}
        subtitle={<span className="font-mono text-sm font-medium text-muted [overflow-wrap:anywhere]">to {ctx.target.username}</span>}
      />
      {view === "form" && <GiveForm ctx={ctx} initialChoice={initialChoice} onClose={onClose} />}
      {view === "limit" && <LimitNotice ctx={ctx} onClose={onClose} />}
      {view === "suspended" && ctx.suspension && <SuspendedNotice suspension={ctx.suspension} onClose={onClose} />}
    </Dialog>
  );
}

function GiveForm({ ctx, initialChoice, onClose }: { ctx: GiveContext; initialChoice: Value; onClose: () => void }) {
  const reasonId = useId();
  const helpId = useId();
  const { existing } = ctx;
  const [choice, setChoice] = useState<Value>(initialChoice);
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await giveAction(ctx.target.uuid, prev, formData);
    if (result.status === "ok") onClose();
    return result;
  }, IDLE);

  const isPlus = choice === 1;
  const missing = !isPlus && !reason.trim();
  const helper = missing
    ? "A −1 needs a reason. Say what happened so other Players can judge."
    : isPlus
      ? "Optional. A few words help others, like what you traded."
      : "Keep it factual. Other Players and Admins will read this.";
  const left = Math.max(0, ctx.limit - ctx.usedToday);

  return (
    <form action={formAction}>
      <input type="hidden" name="value" value={choice} />
      <div className="flex flex-col gap-5 p-5">
        {existing && (
          <div className="flex flex-col gap-2.5 rounded border-2 border-accent-line bg-accent-bg p-3.5">
            <div className="flex items-center gap-2 text-sm font-bold text-accent">
              <LuRotateCcw aria-hidden className="size-4" />
              This replaces the Reputation you gave
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-[3px] bg-accent-deep px-3 py-2.5">
              <ValueChip value={existing.value} />
              <s className="flex-[1_1_200px] text-sm text-accent-dim">{existing.reason ?? "No reason given"}</s>
              <span className="text-xs text-accent-dim">{existing.when}</span>
            </div>
            <p className="m-0 text-[13px] leading-normal text-accent-soft">
              You can only give {ctx.target.username} one +1 or −1. When you save, your old {sign(existing.value)}
              {existing.hasReply ? `, its reason and ${ctx.target.username}'s Reply to it are` : " and its reason are"} deleted for good.
            </p>
          </div>
        )}

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-2.5 p-0 text-sm font-bold">{existing ? "Your new +1 or −1" : "Your +1 or −1"}</legend>
          <div className="flex gap-2.5">
            <ChoiceButton
              value={1}
              pressed={isPlus}
              onPick={setChoice}
              label="Positive"
              hint="Fair trade, good teammate, helpful"
            />
            <ChoiceButton value={-1} pressed={!isPlus} onPick={setChoice} label="Negative" hint="Scam, griefing, broken deal" />
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={reasonId} className="text-sm font-bold">
              Reason
            </label>
            {isPlus ? (
              <span className="inline-flex h-6 items-center rounded-[3px] border border-line-strong bg-surface-3 px-2 text-xs font-semibold text-muted">
                Optional for +1
              </span>
            ) : (
              <span className="inline-flex h-6 items-center rounded-[3px] border border-neg-line bg-neg-bg px-2 text-xs font-bold text-neg">
                Required for −1
              </span>
            )}
          </div>
          <textarea
            id={reasonId}
            name="reason"
            rows={4}
            value={reason}
            maxLength={REASON_MAX}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
            placeholder={isPlus ? "e.g. Fast, fair trade." : "What happened? e.g. Took payment and logged off before trading."}
            required={!isPlus}
            aria-required={!isPlus}
            aria-invalid={missing}
            aria-describedby={helpId}
            className={`${textareaClass} ${missing ? "border-neg-line" : ""}`}
          />
          <div className="flex items-start justify-between gap-3">
            <span id={helpId} className={`flex items-start gap-1.5 text-[13px] leading-[1.45] ${missing ? "text-neg" : "text-muted"}`}>
              {missing && <LuCircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
              {helper}
            </span>
            <Counter value={reason} max={REASON_MAX} />
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded border-2 border-line bg-surface-2 px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <LuClock aria-hidden className="size-3.5 text-accent" />
              {left} of {ctx.limit} left to give today
            </span>
            <Pips used={ctx.usedToday} limit={ctx.limit} size="size-2.5" />
          </div>
          <span className="text-xs leading-[1.45] text-muted">
            {ctx.newPlayerDaysLeft > 0
              ? `New Player limit: ${NEW_PLAYER_DAILY_LIMIT} a day for your first ${NEW_PLAYER_DAYS} days (${ctx.newPlayerDaysLeft} ${ctx.newPlayerDaysLeft === 1 ? "day" : "days"} to go), then ${DAILY_LIMIT} a day.`
              : "Your daily limit resets at 00:00 UTC."}
          </span>
        </div>
        <span className="text-xs text-muted">Reputation you give is public and shows your username, {ctx.viewerName}.</span>
        <ErrorNote message={state.status === "error" ? state.message : null} />
      </div>

      <DialogFooter>
        <button type="button" onClick={onClose} className={buttonSecondary}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={missing || pending}
          className={`shadow-block flex h-12 cursor-pointer items-center rounded border-0 px-[22px] text-[15px] font-bold disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-faint disabled:shadow-none ${
            isPlus ? "bg-pos text-pos-ink" : "bg-neg text-neg-ink"
          }`}
        >
          {pending ? "Saving…" : existing ? "Replace" : `Give ${sign(choice)}`}
        </button>
      </DialogFooter>
    </form>
  );
}

function ChoiceButton({
  value,
  pressed,
  onPick,
  label,
  hint,
}: {
  value: Value;
  pressed: boolean;
  onPick: (v: Value) => void;
  label: string;
  hint: string;
}) {
  const plus = value === 1;
  const on = plus ? "border-pos bg-pos-bg" : "border-neg bg-neg-bg";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPick(value)}
      className={`flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-1.5 rounded border-2 p-3.5 text-left text-ink ${
        pressed ? on : "border-line-strong bg-surface-2"
      }`}
    >
      <span className="flex w-full items-center justify-between">
        <span className={`font-mono text-[26px] leading-tight font-bold ${plus ? "text-pos" : "text-neg"}`}>{sign(value)}</span>
        {pressed && <LuCircleCheck aria-hidden className={`size-5 ${plus ? "text-pos" : "text-neg"}`} />}
      </span>
      <span className="text-[15px] font-bold">{label}</span>
      <span className="text-[13px] leading-[1.4] text-muted">{hint}</span>
    </button>
  );
}

function Pips({ used, limit, size }: { used: number; limit: number; size: string }) {
  return (
    <div aria-hidden className="flex gap-[3px]">
      {Array.from({ length: limit }, (_, i) => (
        <span key={i} className={`${size} ${i < used ? "bg-line-strong" : "bg-accent"}`} />
      ))}
    </div>
  );
}

function LimitNotice({ ctx, onClose }: { ctx: GiveContext; onClose: () => void }) {
  return (
    <>
      <div className="flex flex-col items-center gap-3.5 px-6 py-7 text-center">
        <div className="flex size-14 items-center justify-center rounded border-2 border-accent-line bg-accent-bg text-accent">
          <LuClock aria-hidden className="size-[26px]" />
        </div>
        <h3 className="m-0 font-pixel text-2xl font-bold">No Reputation left to give today</h3>
        <Pips used={ctx.usedToday} limit={ctx.limit} size="size-3" />
        <p className="m-0 max-w-[380px] leading-[1.55] text-ink-2">
          You&apos;ve used all {ctx.limit} for today. You can give more in <strong className="text-ink">{ctx.resetsIn}</strong>, when the
          limit resets at 00:00 UTC.
        </p>
        <p className="m-0 max-w-[380px] text-[13px] leading-[1.55] text-muted">
          New Players can give {NEW_PLAYER_DAILY_LIMIT} a day for their first {NEW_PLAYER_DAYS} days, then {DAILY_LIMIT} a day. You can still
          read every profile and write Replies.
        </p>
      </div>
      <DialogFooter>
        <button type="button" onClick={onClose} className={`${buttonPrimary} px-6`}>
          Got it
        </button>
      </DialogFooter>
    </>
  );
}

function SuspendedNotice({ suspension, onClose }: { suspension: NonNullable<GiveContext["suspension"]>; onClose: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-4 px-6 pt-7 pb-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded border-2 border-neg-line bg-neg-bg text-neg">
            <LuBan aria-hidden className="size-[26px]" />
          </div>
          <h3 className="m-0 font-pixel text-2xl font-bold">You can&apos;t give Reputation right now</h3>
          <p className="m-0 max-w-[400px] leading-[1.55] text-ink-2">
            {suspension.until ? (
              <>
                An Admin suspended you from giving Reputation until <strong className="text-ink">{suspension.until}</strong>.
              </>
            ) : (
              "An Admin suspended you from giving Reputation."
            )}
          </p>
        </div>
        <div className="rounded border-2 border-line bg-surface-2 px-3.5 py-3 text-sm leading-normal">
          <span className="mb-1 block text-xs font-bold tracking-[0.06em] text-muted uppercase">Reason from the Admin</span>
          {suspension.reason}
        </div>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm leading-[1.45] text-ink-2">
          <Bullet ok>Your profile and Reputation stay public. Anyone can still view them.</Bullet>
          <Bullet ok>Other Players can still give you Reputation.</Bullet>
          <Bullet ok>You can still write Replies on Reputation you received.</Bullet>
          <Bullet ok={false}>
            {suspension.until
              ? "You can't give, change or remove Reputation until then."
              : "You can't give, change or remove Reputation while you're suspended."}
          </Bullet>
        </ul>
      </div>
      <DialogFooter>
        <button type="button" onClick={onClose} className={`${buttonSecondary} bg-surface-3 px-6`}>
          Close
        </button>
      </DialogFooter>
    </>
  );
}

function Bullet({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      {ok ? (
        <LuCheck aria-label="Still allowed:" className="size-[18px] shrink-0 text-pos" />
      ) : (
        <LuX aria-label="Not allowed:" className="size-[18px] shrink-0 text-neg" />
      )}
      <span>{children}</span>
    </li>
  );
}

/** Confirms taking back the viewer's +1/−1. Removing never counts toward the daily limit. */
export function RemoveDialog({ ctx, onClose }: { ctx: GiveContext; onClose: () => void }) {
  const titleId = useId();
  const [state, formAction, pending] = useActionState(async () => {
    const result: ActionResult = await removeAction(ctx.target.uuid);
    if (result.status === "ok") onClose();
    return result;
  }, IDLE);
  const existing = ctx.existing;

  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <DialogHeader
        id={titleId}
        title="Remove the Reputation you gave"
        onClose={onClose}
        icon={<SkinHead uuid={ctx.target.uuid} username={ctx.target.username} size={40} />}
        subtitle={<span className="font-mono text-sm font-medium text-muted [overflow-wrap:anywhere]">to {ctx.target.username}</span>}
      />
      <form action={formAction}>
        <div className="flex flex-col gap-4 p-5">
          {existing && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded border-2 border-line bg-surface-2 px-3.5 py-3">
              <ValueChip value={existing.value} />
              <span className="flex-[1_1_200px] text-sm text-ink">{existing.reason ?? <em className="text-muted">No reason given</em>}</span>
              <span className="text-xs text-muted">{existing.when}</span>
            </div>
          )}
          <p className="m-0 text-sm leading-normal text-ink-2">
            {existing ? `Your ${sign(existing.value)} and its reason` : "Your Reputation"}
            {existing?.hasReply ? `, and ${ctx.target.username}'s Reply to it,` : ""} will be deleted for good. Removing doesn&apos;t
            count toward your daily limit.
          </p>
          <ErrorNote message={state.status === "error" ? state.message : null} />
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className={buttonSecondary}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="shadow-block flex h-12 cursor-pointer items-center gap-2 rounded border-0 bg-neg px-[22px] text-[15px] font-bold text-neg-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LuTrash2 aria-hidden className="size-4" />
            {pending ? "Removing…" : "Remove"}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
