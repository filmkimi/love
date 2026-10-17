"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCheck, ImagePlus, LoaderCircle, Send } from "lucide-react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Message } from "@/lib/database.types";
import { playSoftSound } from "@/lib/sounds";
import PrivateImage from "@/components/PrivateImage";

type ChatRoomProps = {
  session: Session;
  userAName: string;
  userBName: string;
  onPokeChannel: (channel: RealtimeChannel | null) => void;
};

type PresenceState = { user_id: string; name: string; isTyping: boolean; online_at: string };

const HEART = "❤️";

function formatTime(date: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

export default function ChatRoom({ session, userAName, userBName, onPokeChannel }: ChatRoomProps) {
  const supabase = getSupabaseBrowserClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  const myName = session.user.user_metadata?.display_name || userAName;

  useEffect(() => {
    let active = true;
    async function loadMessages() {
      const { data, error: loadError } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      if (loadError) setError(`Could not load messages: ${loadError.message}`);
      else {
        const loadedMessages = (data as Message[]).reverse();
        setMessages((current) => {
          const byId = new Map(loadedMessages.map((message) => [message.id, message]));
          current.forEach((message) => byId.set(message.id, message));
          return [...byId.values()].sort((first, second) => first.created_at.localeCompare(second.created_at));
        });
        const unreadIds = (data as Message[])
          .filter((message) => message.sender_id !== session.user.id && !message.is_read)
          .map((message) => message.id);
        if (unreadIds.length) {
          const { error: readError } = await supabase.from("messages").update({ is_read: true }).in("id", unreadIds);
          if (readError && active) setError(`Could not update read receipts: ${readError.message}`);
        }
      }
      if (active) setLoading(false);
    }

    void loadMessages();

    const channel = supabase.channel("couple-room", {
      config: { presence: { key: session.user.id } }
    });
    channelRef.current = channel;
    onPokeChannel(channel);
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as Message;
        if (payload.eventType === "INSERT") {
          setMessages((current) => current.some((message) => message.id === row.id) ? current : [...current, row]);
          if (row.sender_id !== session.user.id) playSoftSound("pop");
          if (row.sender_id !== session.user.id && !row.is_read) {
            void supabase.from("messages").update({ is_read: true }).eq("id", row.id).then(({ error: readError }) => {
              if (readError) setError(`Could not update read receipt: ${readError.message}`);
            });
          }
        } else if (payload.eventType === "UPDATE") {
          setMessages((current) => current.map((message) => message.id === row.id ? row : message));
        } else if (payload.eventType === "DELETE") {
          const removed = payload.old as Pick<Message, "id">;
          setMessages((current) => current.filter((message) => message.id !== removed.id));
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceState>();
        const users = Object.values(state).flat();
        setOnlineUsers(users.filter((user) => user.user_id !== session.user.id).map((user) => user.name));
        setTypingUsers(users.filter((user) => user.user_id !== session.user.id && user.isTyping).map((user) => user.name));
      })
      .on("broadcast", { event: "poke" }, () => {
        window.dispatchEvent(new CustomEvent("couple:poke"));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const presence: PresenceState = {
            user_id: session.user.id,
            name: myName,
            isTyping: false,
            online_at: new Date().toISOString()
          };
          const trackStatus = await channel.track(presence);
          if (trackStatus !== "ok") setError(`Presence unavailable: ${trackStatus}`);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError("Live chat disconnected. Check your Supabase Realtime settings and connection.");
        }
      });

    return () => {
      active = false;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      onPokeChannel(null);
      void supabase.removeChannel(channel);
    };
  }, [myName, onPokeChannel, session.user.id, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const sendMessage = useCallback(async (text: string, imageUrl: string | null = null) => {
    if (!text.trim() && !imageUrl) return;
    setSending(true);
    setError("");
    const { error: insertError } = await supabase.from("messages").insert({
      sender_id: session.user.id,
      text: text.trim() || null,
      image_url: imageUrl
    });
    if (insertError) setError(`Message not sent: ${insertError.message}`);
    else setDraft("");
    setSending(false);
    await channelRef.current?.track({
      user_id: session.user.id,
      name: myName,
      isTyping: false,
      online_at: new Date().toISOString()
    } satisfies PresenceState);
    inputRef.current?.focus();
  }, [myName, session.user.id, supabase]);

  function handleDraft(value: string) {
    setDraft(value);
    void channelRef.current?.track({
      user_id: session.user.id,
      name: myName,
      isTyping: value.trim().length > 0,
      online_at: new Date().toISOString()
    } satisfies PresenceState);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      void channelRef.current?.track({
        user_id: session.user.id,
        name: myName,
        isTyping: false,
        online_at: new Date().toISOString()
      } satisfies PresenceState);
    }, 1400);
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file to share.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Images must be smaller than 8 MB.");
      return;
    }
    setUploading(true);
    setError("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
    const { data, error: uploadError } = await supabase.storage.from("chat-media").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });
    if (uploadError) {
      setError(`Image upload failed: ${uploadError.message}`);
    } else {
      await sendMessage("", `chat-media/${data.path}`);
    }
    setUploading(false);
  }

  async function reactToMessage(message: Message) {
    const { error: updateError } = await supabase
      .from("messages")
      .update({ reaction: message.reaction === HEART ? null : HEART })
      .eq("id", message.id);
    if (updateError) setError(`Could not add reaction: ${updateError.message}`);
  }

  function tapMessage(message: Message) {
    const now = Date.now();
    if (lastTap.current?.id === message.id && now - lastTap.current.at < 350) {
      void reactToMessage(message);
      lastTap.current = null;
    } else {
      lastTap.current = { id: message.id, at: now };
    }
  }

  return (
    <section className="overflow-hidden rounded-[1.8rem] border border-white/80 bg-white/85 shadow-soft backdrop-blur">
      <header className="flex items-center justify-between border-b border-rose-100/70 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative grid h-11 w-11 place-items-center rounded-full bg-blush text-xl">💌
            <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${onlineUsers.length ? "bg-emerald-400" : "bg-gray-300"}`} />
          </div>
          <div>
            <h2 className="serif text-xl">Our messages</h2>
            <p className="text-xs text-ink/55">{onlineUsers.length ? "Here with you now" : "Just between us"}</p>
          </div>
        </div>
        <span className="rounded-full bg-[#f8f3ee] px-3 py-1.5 text-[11px] font-semibold text-plum">
          {onlineUsers.length ? "Active now" : userBName}
        </span>
      </header>

      <div className="hide-scrollbar flex h-[410px] flex-col gap-4 overflow-y-auto bg-[linear-gradient(180deg,#fffdfb_0%,#fff9f7_100%)] px-4 py-5 sm:px-6">
        <p className="mx-auto rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.17em] text-ink/40">A little space for us</p>
        {loading && <LoaderCircle className="mx-auto mt-16 animate-spin text-plum/70" />}
        {!loading && messages.length === 0 && (
          <div className="mx-auto my-auto max-w-[220px] text-center text-sm leading-6 text-ink/50">
            Your story starts here. Send the first little hello ✨
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((message) => {
            const mine = message.sender_id === session.user.id;
            return (
              <motion.div
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                key={message.id}
                layout
              >
                <div
                  className={`relative max-w-[82%] cursor-pointer rounded-[1.35rem] px-4 py-3 text-sm shadow-sm ${mine ? "rounded-br-md bg-plum text-white" : "rounded-bl-md border border-rose-100/80 bg-white text-ink"}`}
                  onClick={() => tapMessage(message)}
                  onDoubleClick={() => void reactToMessage(message)}
                >
                  {message.image_url && <PrivateImage alt="Shared in your chat" bucket="chat-media" className="mb-2 aspect-video w-full overflow-hidden rounded-xl" reference={message.image_url} />}
                  {message.text && <p className="whitespace-pre-wrap break-words leading-5">{message.text}</p>}
                  <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/65" : "text-ink/40"}`}>
                    <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
                    {mine && (message.is_read ? <CheckCheck size={13} /> : <Check size={13} />)}
                  </div>
                  {message.reaction && (
                    <span className={`absolute -bottom-3 ${mine ? "left-2" : "right-2"} grid h-6 min-w-6 place-items-center rounded-full border border-rose-100 bg-white px-1 text-xs shadow-sm`}>
                      {message.reaction}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-ink/50">
            <span className="flex gap-1 rounded-full bg-white px-3 py-2">
              <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-plum/50 [animation-delay:-0.2s]" />
              <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-plum/50 [animation-delay:-0.1s]" />
              <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-plum/50" />
            </span>
            {typingUsers[0]} is typing
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="bg-red-50 px-5 py-2 text-xs text-red-700" role="alert">{error}</p>}
      <form
        className="safe-bottom flex items-center gap-2 border-t border-rose-100/70 bg-white px-3 pt-3 sm:px-5"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage(draft);
        }}
      >
        <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-plum/75 transition hover:bg-blush" title="Share an image">
          {uploading ? <LoaderCircle className="animate-spin" size={18} /> : <ImagePlus size={19} />}
          <input accept="image/*" className="sr-only" disabled={uploading || sending} onChange={(event) => {
            void uploadImage(event.target.files?.[0]);
            event.currentTarget.value = "";
          }} type="file" />
        </label>
        <input
          className="min-w-0 flex-1 rounded-full bg-[#f8f4f1] px-4 py-2.5 text-sm outline-none placeholder:text-ink/35"
          onChange={(event) => handleDraft(event.target.value)}
          placeholder="Write a little something…"
          ref={inputRef}
          value={draft}
        />
        <button
          aria-label="Send message"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-plum text-white transition hover:bg-[#67435e] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={sending || uploading || !draft.trim()}
          type="submit"
        >
          {sending ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}
        </button>
      </form>
    </section>
  );
}
