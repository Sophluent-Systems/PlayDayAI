"use client";
import ReactGA from "react-ga4";

export const analyticsInitialize = (analyticsID) => {
  // Replace with your Measurement ID
  // It ideally comes from an environment variable
//  ReactGA.initialize(analyticsID);

  console.log("Google Analytics disabled for now")
};

export function analyticsReportEvent(eventName, value) {
  //console.log("GA analyticsReportEvent:", eventName, ":",value);
  // Send GA4 Event
  //ReactGA.event(eventName, value);
}