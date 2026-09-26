/**
 * Shapes returned by server actions, plus their idle values.
 *
 * These live here rather than beside the actions on purpose. A `"use server"`
 * module may only export async functions, so a plain object like
 * `initialRegisterState` is a runtime error the moment the module is imported
 * from a component — `A "use server" file can only export async functions`.
 * Keeping every state type and its idle value in one ordinary module means the
 * action files export nothing but actions, and client components have a single
 * obvious place to import both halves from.
 */

export interface RegisterState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
  entryNumber?: string;
  claimCode?: string | null;
  eventName?: string;
  eventSlug?: string;
  showCaptcha?: boolean;
  retryAfterSeconds?: number;
}

export const initialRegisterState: RegisterState = { status: "idle" };

export interface AccountState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialAccountState: AccountState = { status: "idle" };

export interface DrawActionState {
  status: "idle" | "success" | "error";
  message?: string;
  /** Full verification report, shown after a successful run or verify. */
  verification?: {
    drawId: string;
    commitMatches: boolean;
    poolHashMatches: boolean;
    winnersMatch: boolean;
    winnerEntryNumbers: string[];
    reproducedEntryNumbers: string[];
  } | null;
  winners?: Array<{ entryNumber: string; prizeName: string }>;
  code?: string;
}

export const initialDrawState: DrawActionState = { status: "idle" };

export interface AdminActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Set after a successful create so the UI can redirect to the new event. */
  createdId?: string;
}

export const initialAdminState: AdminActionState = { status: "idle" };

export interface ParticipantActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  changedCount?: number;
}

export const initialParticipantState: ParticipantActionState = { status: "idle" };

export interface WinnerActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialWinnerState: WinnerActionState = { status: "idle" };
