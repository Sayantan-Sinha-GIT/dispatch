"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";
import { useDataSaver } from "@/components/DataSaverProvider";
import { liteImageUrl } from "@/lib/dataSaver";

/**
 * A product photograph, with the old CSS gradient kept as the fallback.
 *
 * Every product has artwork today, but `image_url` is nullable and the admin
 * console can create a product without one — so a missing photo has to degrade
 * to the gradient rather than to a broken-image icon. The same fallback covers
 * a file that 404s after a bad deploy.
 */
export function ProductImage({
  src,
  gradient,
  alt,
  sizes,
  priority = false,
  className = "",
  zoomOnHover = true,
}: {
  src: string | null;
  gradient: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  zoomOnHover?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const { on: lite } = useDataSaver();
  const showPhoto = src && !failed;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {showPhoto ? (
        <motion.div
          className="h-full w-full"
          whileHover={zoomOnHover ? { scale: 1.07 } : undefined}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
        >
          {lite ? (
            // One small, compressed copy (about a tenth of the full one), not a
            // screen-density srcset: in Data Saver the card is the size budget.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={liteImageUrl(src, 384)}
              alt={alt}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              onError={() => setFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Image
              src={src}
              alt={alt}
              fill
              sizes={sizes}
              priority={priority}
              onError={() => setFailed(true)}
              className="object-cover"
            />
          )}
        </motion.div>
      ) : (
        <div className={`h-full w-full bg-gradient-to-br ${gradient}`} />
      )}

      {/*
        The photographs are lit from the upper left and fall into shadow at the
        bottom. This gradient deepens that fall so the product name underneath
        has something to sit against, instead of text meeting a hard edge.
      */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
    </div>
  );
}
