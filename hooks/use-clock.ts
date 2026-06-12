"use client";

import { useState, useEffect } from "react";

export function useClock(): string {
  const [time, setTime] = useState(() => formatTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime());
    }, 60_000);

    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    const timeout = setTimeout(() => {
      setTime(formatTime());
    }, msUntilNextMinute);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return time;
}

function formatTime(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "short" });
  const date = now.getDate();
  const month = now.toLocaleDateString("en-US", { month: "short" });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const tzAbbr = now
    .toLocaleTimeString("en-US", { timeZoneName: "short" })
    .split(" ")
    .pop() || "";
  return `${day} ${date} ${month} ${time} ${tzAbbr}`;
}
