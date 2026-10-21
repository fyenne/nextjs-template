"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check } from "lucide-react";

interface CopyEmailButtonProps {
  email?: string;
  className?: string;
}

export default function CopyEmailButton({
  email = "fyenne@hotmail.com",
  className = "",
}: CopyEmailButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(email);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = email;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy email:", err);
    }
  };

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded transition-colors text-white ${
        copied
          ? "bg-emerald-600 hover:bg-emerald-500"
          : "bg-emerald-700 hover:bg-emerald-600"
      } ${className}`}
      aria-label={copied ? "Email copied to clipboard" : `Copy email address ${email}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            className="inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Copied!</span>
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            className="inline-flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Email</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
