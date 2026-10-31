/** Delhi proper is the default map viewport; station coverage includes NCR. */
export const delhiNcr = {
  id: "delhi-ncr",
  name: "Delhi-NCR",
  timezone: "Asia/Kolkata",
  h3Resolution: 8,
  stationBounds: { south: 28.2, north: 29.1, west: 76.7, east: 77.7 },
  map: {
    center: [77.19, 28.65] as [number, number],
    zoom: 10.1,
    polygon: [
      [28.46, 76.96],
      [28.79, 76.96],
      [28.88, 77.17],
      [28.79, 77.36],
      [28.61, 77.43],
      [28.45, 77.27],
      [28.46, 76.96],
    ],
  },
  replay: { buildUpHours: -48, burstHourIst: 17, hangoverHours: 24 },
  calendarNote:
    "Replay uses Lakshmi Puja dates in the model calendar. Local festival observance can vary.",
};
