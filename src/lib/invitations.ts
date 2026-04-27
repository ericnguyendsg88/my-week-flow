import { supabase } from "./supabase";
import { CalEvent } from "@/types/event";

export interface Invitation {
  id: string;
  host_name: string | null;
  title: string;
  date: string;
  start: number;
  duration: number;
  where_: string | null;
  tag_id: string | null;
  note: string | null;
  created_at?: string;
}

export interface Rsvp {
  id?: string;
  invitation_id: string;
  guest_name: string;
  status: "accepted" | "declined" | "maybe";
  message?: string | null;
  created_at?: string;
}

function rid() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}

export async function createInvitation(event: CalEvent, hostName?: string, note?: string): Promise<Invitation> {
  const inv: Invitation = {
    id: rid(),
    host_name: hostName?.trim() || null,
    title: event.title,
    date: event.date,
    start: event.start,
    duration: event.duration,
    where_: event.where || null,
    tag_id: event.tagId || null,
    note: note?.trim() || null,
  };
  const { error } = await supabase.from("invitations").insert(inv);
  if (error) throw error;
  return inv;
}

export async function getInvitation(id: string): Promise<Invitation | null> {
  const { data, error } = await supabase.from("invitations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Invitation) || null;
}

export async function listRsvps(invitationId: string): Promise<Rsvp[]> {
  const { data, error } = await supabase
    .from("invitation_rsvps")
    .select("*")
    .eq("invitation_id", invitationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as Rsvp[]) || [];
}

export async function submitRsvp(rsvp: Rsvp): Promise<void> {
  const { error } = await supabase.from("invitation_rsvps").insert(rsvp);
  if (error) throw error;
}

export function invitationUrl(id: string) {
  return `${window.location.origin}/invite/${id}`;
}
