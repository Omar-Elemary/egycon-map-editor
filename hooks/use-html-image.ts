"use client";

import { useEffect, useState } from "react";

export function useHtmlImage(url: string | undefined): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement>();

  useEffect(() => {
    if (!url) {
      setImage(undefined);
      return;
    }
    let cancelled = false;
    const element = new window.Image();
    element.onload = () => {
      if (!cancelled) setImage(element);
    };
    element.onerror = () => {
      if (!cancelled) setImage(undefined);
    };
    element.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return image;
}
