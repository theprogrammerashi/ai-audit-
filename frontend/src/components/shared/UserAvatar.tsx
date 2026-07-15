"use client";

import { getInitials } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  isAI?: boolean;
  size?: number;
}

export default function UserAvatar({ name, isAI = false, size = 36 }: UserAvatarProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: size * 0.35,
        color: "#FFFFFF",
        background: isAI
          ? "linear-gradient(135deg, #E8521A 0%, #C94415 100%)"
          : "linear-gradient(135deg, #6B6860 0%, #4A4943 100%)",
        flexShrink: 0,
      }}
    >
      {isAI ? "CA" : getInitials(name)}
    </div>
  );
}
