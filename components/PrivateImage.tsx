"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, LoaderCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { downloadPrivateMedia } from "@/lib/privateMedia";

type PrivateImageProps = {
  bucket: "chat-media" | "couple-memories";
  reference: string;
  alt: string;
  className: string;
};

export default function PrivateImage({ bucket, reference, alt, className }: PrivateImageProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let started = false;
    let currentUrl: string | null = null;

    async function load() {
      if (started) return;
      started = true;
      const url = await downloadPrivateMedia(getSupabaseBrowserClient(), bucket, reference);
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (url) {
        currentUrl = url;
        setObjectUrl(url);
      } else {
        setFailed(true);
      }
    }

    const target = elementRef.current;
    if (target && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void load();
        }
      }, { rootMargin: "250px" });
      observer.observe(target);
      return () => {
        active = false;
        observer.disconnect();
        if (currentUrl) URL.revokeObjectURL(currentUrl);
      };
    }

    void load();
    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [bucket, reference]);

  return (
    <div className={className} ref={elementRef}>
      {objectUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt} className="h-full w-full object-cover" loading="lazy" src={objectUrl} />
      ) : (
        <span className="grid h-full w-full place-items-center text-plum/45">
          {failed ? <ImageOff size={22} /> : <LoaderCircle className="animate-spin" size={20} />}
        </span>
      )}
    </div>
  );
}
