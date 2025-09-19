'use client'
 import { sendGTMEvent } from '@next/third-parties/google'

export function analyticsReportEvent(eventName, value) {
  console.log("GA analyticsReportEvent:", eventName, ":",value);
  sendGTMEvent({ event: eventName, value: value });
}