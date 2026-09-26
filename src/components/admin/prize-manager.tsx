"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { GripVertical, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input, Textarea } from "@/components/ui/input";
import { TableShell, Td, Th, Tr } from "@/components/ui/feedback";
import {
  createPrizeAction,
  deletePrizeAction,
  updatePrizeAction,
} from "@/server/actions/admin-events";
import { initialAdminState, type AdminActionState } from "@/lib/action-state";

export interface AdminPrize {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  order: number;
  claimInstructions: string | null;
  winnerCount: number;
}

function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: "primary" | "outline" | "ghost" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        variant === "danger"
          ? "inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
          : variant === "ghost"
            ? "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            : variant === "outline"
              ? "inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-leaf-400 hover:text-leaf-800 disabled:opacity-50"
              : `inline-flex h-9 items-center gap-1.5 rounded-lg bg-leaf-700 px-3 text-xs font-bold text-white transition hover:bg-leaf-800 disabled:opacity-50 ${className ?? ""}`
      }
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Add-prize form. Collapsed by default so the table stays the focus. */
function AddPrizeForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    createPrizeAction,
    initialAdminState,
  );

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add a prize
      </Button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-4 rounded-2xl border border-leaf-200 bg-leaf-50/40 p-4">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <Field label="Prize name" htmlFor="new-prize-name" required error={state.fieldErrors?.name?.[0]}>
          <Input id="new-prize-name" name="name" required maxLength={160} placeholder="Cash voucher" />
        </Field>
        <Field label="How many" htmlFor="new-prize-quantity" required error={state.fieldErrors?.quantity?.[0]}>
          <Input
            id="new-prize-quantity"
            type="number"
            name="quantity"
            defaultValue={1}
            min={1}
            max={1000}
            required
          />
        </Field>
      </div>
      <Field label="Description" htmlFor="new-prize-description" optional error={state.fieldErrors?.description?.[0]}>
        <Input id="new-prize-description" name="description" maxLength={300} placeholder="50,000 KRW voucher" />
      </Field>
      <Field
        label="Claim instructions"
        htmlFor="new-prize-claim"
        optional
        error={state.fieldErrors?.claimInstructions?.[0]}
        hint="Shown to the winner privately. Not published on the winners page."
      >
        <Textarea id="new-prize-claim" name="claimInstructions" rows={2} maxLength={500} />
      </Field>

      {state.status === "error" && state.message ? (
        <FormAlert tone="error">{state.message}</FormAlert>
      ) : null}
      {state.status === "success" ? (
        <FormAlert tone="success" title="Added">
          {state.message}
        </FormAlert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Adding…">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add prize
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PrizeRow({ prize, locked }: { prize: AdminPrize; locked: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    updatePrizeAction,
    initialAdminState,
  );

  return (
    <Tr>
      <Td>
        <span className="flex items-center gap-1.5">
          <GripVertical className="h-4 w-4 text-slate-300" aria-hidden="true" />
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-leaf-100 text-xs font-extrabold text-leaf-800">
            {prize.order}
          </span>
        </span>
      </Td>

      {!editing ? (
        <>
          <Td>
            <span className="font-semibold text-slate-800">{prize.name}</span>
            {prize.description ? (
              <span className="mt-0.5 block text-xs text-slate-500">{prize.description}</span>
            ) : null}
            {prize.claimInstructions ? (
              <span className="mt-0.5 block text-[0.7rem] italic text-slate-400">
                Claim: {prize.claimInstructions}
              </span>
            ) : null}
          </Td>
          <Td className="text-center text-sm font-bold text-slate-700">×{prize.quantity}</Td>
          <Td className="text-sm text-slate-600">
            {prize.winnerCount > 0 ? `${prize.winnerCount} awarded` : "—"}
          </Td>
          <Td>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={locked}
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </Button>
              {!locked && prize.winnerCount === 0 ? (
                <form action={deletePrizeAction}>
                  <input type="hidden" name="prizeId" value={prize.id} />
                  <SubmitButton variant="ghost" pendingLabel="Deleting…">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </SubmitButton>
                </form>
              ) : null}
            </div>
          </Td>
        </>
      ) : (
        <Td className="col-span-4">
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="prizeId" value={prize.id} />
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <Field label="Prize name" htmlFor={`name-${prize.id}`} required error={state.fieldErrors?.name?.[0]}>
                <Input id={`name-${prize.id}`} name="name" defaultValue={prize.name} required maxLength={160} />
              </Field>
              <Field label="How many" htmlFor={`qty-${prize.id}`} required error={state.fieldErrors?.quantity?.[0]}>
                <Input
                  id={`qty-${prize.id}`}
                  type="number"
                  name="quantity"
                  defaultValue={prize.quantity}
                  min={1}
                  max={1000}
                  required
                />
              </Field>
            </div>
            <Field label="Description" htmlFor={`desc-${prize.id}`} optional>
              <Input id={`desc-${prize.id}`} name="description" defaultValue={prize.description ?? ""} maxLength={300} />
            </Field>
            <Field label="Claim instructions" htmlFor={`claim-${prize.id}`} optional>
              <Textarea
                id={`claim-${prize.id}`}
                name="claimInstructions"
                defaultValue={prize.claimInstructions ?? ""}
                rows={2}
                maxLength={500}
              />
            </Field>

            {state.status === "error" && state.message ? (
              <FormAlert tone="error">{state.message}</FormAlert>
            ) : null}
            {state.status === "success" ? (
              <FormAlert tone="success" title="Saved">
                {state.message}
              </FormAlert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Saving…">
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                Save
              </SubmitButton>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Cancel
              </Button>
            </div>
          </form>
        </Td>
      )}
    </Tr>
  );
}

/** Prize table. Order is the draw order, and it is frozen with the pool. */
export function PrizeManager({
  eventId,
  prizes,
  locked,
}: {
  eventId: string;
  prizes: AdminPrize[];
  locked: boolean;
}) {
  const slots = prizes.reduce((sum, prize) => sum + prize.quantity, 0);

  if (locked) {
    return (
      <FormAlert tone="warning" title="Prizes are frozen">
        The participant pool is locked, so the prize list and the number of slots can no longer
        change. Revoking a prize is recorded as a correction on the winners page.
      </FormAlert>
    );
  }

  return (
    <div className="space-y-4">
      <AddPrizeForm eventId={eventId} />

      {prizes.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          No prizes yet. A draw needs at least one prize with a quantity of one or more.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {prizes.length} prize {prizes.length === 1 ? "type" : "types"} ·{" "}
            <strong className="text-leaf-800">{slots}</strong> winning slots, drawn in the order
            shown.
          </p>
          <TableShell className="rounded-xl border border-slate-200">
            <thead>
              <tr>
                <Th className="w-20">Order</Th>
                <Th>Prize</Th>
                <Th className="text-center">Quantity</Th>
                <Th>Winners</Th>
                <Th className="no-print">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {prizes.map((prize) => (
                <PrizeRow key={prize.id} prize={prize} locked={locked} />
              ))}
            </tbody>
          </TableShell>
        </>
      )}
    </div>
  );
}
