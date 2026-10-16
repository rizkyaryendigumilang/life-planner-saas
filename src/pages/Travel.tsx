import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin, Plus, PlaneTakeoff, Download } from "lucide-react";
import { pb } from "../lib/pocketbase";
import { Badge, Button, Card, Dialog, Input, Label } from "../components/ui";
import { formatDate, formatIDR } from "../lib/utils";
import { downloadIcs } from "../lib/calendar";
import { toast } from "sonner";
import type { Itinerary, Trip } from "../types";

export function Travel(){
 const [trips,setTrips]=useState<Trip[]>([]);const [itins,setItins]=useState<Itinerary[]>([]);const [open,setOpen]=useState(false);const [selected,setSelected]=useState<Trip|null>(null);
 useEffect(()=>{(async()=>{try{const [a,b]=await Promise.all([pb.collection("travel_trips").getList<Trip>(1,20,{sort:"start_date"}),pb.collection("itineraries").getList<Itinerary>(1,100,{sort:"date,start_time"})]);setTrips(a.items);setItins(b.items)}catch{}})()},[]);
 const next=trips.filter(t=>new Date(t.start_date)>=new Date()).sort((a,b)=>+new Date(a.start_date)-+new Date(b.start_date))[0];
 const countdown=next?Math.max(0,Math.ceil((+new Date(next.start_date)-Date.now())/86400000)):null;
 const current=selected||next;
 const tripItems=current?itins.filter(i=>i.trip===current.id):[];
 function exportTrip() {
   if (!current) return;

   const events = tripItems.map((i) => {
     const [h, m] = i.start_time.split(":").map(Number);
     const start = new Date(i.date);
     start.setHours(h, m, 0, 0);

     const end = new Date(start);
     const [eh, em] = (i.end_time || i.start_time).split(":").map(Number);
     end.setHours(eh, em || m, 0, 0);

     if (end <= start) end.setMinutes(end.getMinutes() + 60);

     return {
       title: i.title,
       location: i.location || "",
       description: i.notes || "",
       start: start.toISOString(),
       end: end.toISOString(),
     };
   });

   const filename = `${current.name.replace(/\s+/g, "-").toLowerCase()}.ics`;
   downloadIcs(filename, events);
   toast.success("Calendar file downloaded");
 }
 return <div className="animate-rise"><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-[-.03em]">Traveling Hub</h1><p className="mt-1 text-sm text-ink-soft">Budget the journey, then enjoy the journey.</p></div><Button onClick={()=>setOpen(true)}><Plus size={16}/> New trip</Button></div>
 {current?<><Card className="overflow-hidden"><div className="grid gap-0 lg:grid-cols-[1.3fr_.7fr]"><div className="border-b border-line/15 p-6 lg:border-b-0 lg:border-r"><div className="flex items-center gap-2"><Badge tone="accent">Next trip</Badge><span className="text-xs text-ink-soft">{formatDate(current.start_date)} — {formatDate(current.end_date)}</span></div><h2 className="mt-4 text-3xl font-semibold tracking-tight">{current.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-ink-soft"><MapPin size={14}/>{current.destination}</p><div className="mt-7 grid grid-cols-3 gap-3"><div><p className="text-xs text-ink-soft">Countdown</p><p className="mt-1 text-2xl font-semibold">{countdown}<span className="ml-1 text-sm font-normal text-ink-soft">days</span></p></div><div><p className="text-xs text-ink-soft">Budget</p><p className="mt-1 text-sm font-semibold">{formatIDR(current.budget)}</p></div><div><p className="text-xs text-ink-soft">Actual</p><p className="mt-1 text-sm font-semibold">{formatIDR(current.actual)}</p></div></div></div><div className="p-6"><p className="text-xs text-ink-soft">Budget remaining</p><p className="mt-1 text-2xl font-semibold">{formatIDR(current.budget-current.actual)}</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{width:`${Math.min(100,current.budget?current.actual/current.budget*100:0)}%`}}/></div><div className="mt-6 flex gap-2"><Button size="sm" onClick={exportTrip}><Download size={14}/> Export .ics</Button><Button size="sm" variant="outline" onClick={()=>setSelected(null)}>Next trip</Button></div></div></div></Card><div className="mt-4 grid gap-4 lg:grid-cols-[.35fr_.65fr]"><Card className="p-5"><h2 className="font-semibold">Your trips</h2><div className="mt-3 space-y-1">{trips.map(t=><button key={t.id} onClick={()=>setSelected(t)} className="w-full rounded-xl px-3 py-3 text-left hover:bg-muted"><p className="text-sm font-medium">{t.name}</p><p className="mt-1 text-xs text-ink-soft">{t.destination} · {formatDate(t.start_date)}</p></button>)}</div></Card><Card className="overflow-hidden"><div className="border-b border-line/10 p-5"><h2 className="font-semibold">Itinerary</h2><p className="mt-1 text-xs text-ink-soft">Structured by date and time</p></div><div className="divide-y divide-line/10">{tripItems.length?tripItems.map(i=><div key={i.id} className="grid gap-3 p-4 sm:grid-cols-[100px_1fr]"><div className="flex items-center gap-1 text-xs font-medium text-ink-soft"><Clock3 size={14}/>{i.start_time}</div><div><p className="text-sm font-semibold">{i.title}</p><p className="mt-1 flex flex-wrap gap-3 text-xs text-ink-soft"><span className="flex items-center gap-1"><CalendarDays size={13}/>{formatDate(i.date)}</span>{i.location&&<span className="flex items-center gap-1"><MapPin size={13}/>{i.location}</span>}</p></div></div>):<div className="p-10 text-center text-sm text-ink-soft">No itinerary items yet.</div>}</div></Card></div></>:<Card className="grid place-items-center p-16 text-center"><PlaneTakeoff size={30}/><h2 className="mt-4 font-semibold">No trips yet</h2><p className="mt-1 text-sm text-ink-soft">Create a trip to start your countdown and itinerary.</p><Button className="mt-5" onClick={()=>setOpen(true)}><Plus size={16}/> Create trip</Button></Card>}
 <TripDialog open={open} onOpenChange={setOpen} onCreate={async d=>{try{const rec=await pb.collection("travel_trips").create<Trip>({...d,user:pb.authStore.record!.id,actual:0});setTrips(x=>[...x,rec]);setSelected(rec);setOpen(false);toast.success("Trip created")}catch(e){toast.error(e instanceof Error?e.message:"Could not create trip")}}}/>
 </div>
}
function TripDialog({open,onOpenChange,onCreate}:{open:boolean;onOpenChange:(v:boolean)=>void;onCreate:(d:Partial<Trip>)=>void}){const [name,setName]=useState("");const [destination,setDestination]=useState("");const [start,setStart]=useState("");const [end,setEnd]=useState("");const [budget,setBudget]=useState("");return <Dialog open={open} onOpenChange={onOpenChange} title="New trip"><div className="space-y-4"><div><Label>Trip name</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Tokyo 2027"/></div><div><Label>Destination</Label><Input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Tokyo, Japan"/></div><div className="grid grid-cols-2 gap-3"><div><Label>Start</Label><Input type="date" value={start} onChange={e=>setStart(e.target.value)}/></div><div><Label>End</Label><Input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></div></div><div><Label>Budget</Label><Input type="number" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="0"/></div><Button className="w-full" disabled={!name||!destination||!start||!end} onClick={()=>onCreate({name,destination,start_date:start,end_date:end,budget:Number(budget)||0})}>Create trip</Button></div></Dialog>}
