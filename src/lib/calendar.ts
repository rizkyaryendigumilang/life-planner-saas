export function downloadIcs(filename: string, events: Array<{ title: string; start: string; end?: string; description?: string; location?: string }>) {
  const clean = (s = "") => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const stamp = (s: string) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s.replaceAll("-", "").replaceAll(":", "").replace("T", "");
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Life Planner//EN", ...events.flatMap((e, i) => [
    "BEGIN:VEVENT", `UID:${Date.now()}-${i}@life-planner`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(e.start)}`, ...(e.end ? [`DTEND:${stamp(e.end)}`] : []), `SUMMARY:${clean(e.title)}`, ...(e.description ? [`DESCRIPTION:${clean(e.description)}`] : []), ...(e.location ? [`LOCATION:${clean(e.location)}`] : []), "END:VEVENT",
  ]), "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`; a.click(); URL.revokeObjectURL(url);
}
