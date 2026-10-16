import { useEffect, useMemo, useState } from "react";
import { Camera, Dog, Plus, Search, Trash2, Cat, Bird, Fish, Rabbit } from "lucide-react";
import { pb } from "../lib/pocketbase";
import { Badge, Button, Card, Dialog, Input, Label, Select, SelectItem, Textarea } from "../components/ui";
import { toast } from "sonner";
import type { Pet, PetSpecies } from "../types";

const species: PetSpecies[] = ["Dog", "Cat", "Bird", "Fish", "Rabbit", "Other"];
const SpeciesIcon = ({ type }: { type: PetSpecies }) => {
  const Icon = type === "Dog" ? Dog : type === "Cat" ? Cat : type === "Bird" ? Bird : type === "Fish" ? Fish : type === "Rabbit" ? Rabbit : Dog;
  return <Icon size={18} />;
};

export function Pets() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const load = async () => {
    try { const r = await pb.collection("pets").getList<Pet>(1, 100, { sort: "name" }); setPets(r.items); } catch {}
  };
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => pets.filter(p => `${p.name} ${p.species} ${p.breed || ""}`.toLowerCase().includes(search.toLowerCase())), [pets, search]);
  const photo = (p: Pet) => p.photo ? pb.files.getURL(p, p.photo, { thumb: "300x300" }) : "";
  async function remove(p: Pet) { try { await pb.collection("pets").delete(p.id); setPets(x => x.filter(i => i.id !== p.id)); toast.success(`${p.name} removed`); } catch { toast.error("Could not remove pet"); } }
  return <div className="animate-rise">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-3xl font-semibold tracking-[-.03em]">Pet Management</h1><p className="mt-1 text-sm text-ink-soft">Keep every pet as a profile, not just an expense category.</p></div>
      <Button onClick={() => setOpen(true)}><Plus size={16}/> Add pet</Button>
    </div>
    <div className="mb-5 flex items-center justify-between gap-3"><div className="relative w-full max-w-sm"><Search size={16} className="absolute left-3 top-3 text-ink-soft"/><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pets…" className="pl-9"/></div><span className="text-xs text-ink-soft">{filtered.length} pets</span></div>
    {filtered.length === 0 ? <Card className="grid min-h-56 place-items-center p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted"><Dog size={22}/></div><h2 className="mt-3 font-semibold">No pets yet</h2><p className="mt-1 text-sm text-ink-soft">Add your first pet with a profile photo and basic details.</p><Button className="mt-4" onClick={() => setOpen(true)}><Plus size={16}/> Add pet</Button></div></Card> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(p => <Card key={p.id} className="group overflow-hidden"><div className="relative aspect-[1.25] bg-muted">{photo(p) ? <img src={photo(p)} alt={p.name} className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-ink-faint"><SpeciesIcon type={p.species}/></div>}<div className="absolute left-3 top-3"><Badge>{p.species}</Badge></div><button onClick={() => remove(p)} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-surface/90 text-ink-soft opacity-0 shadow-sm transition group-hover:opacity-100 hover:text-negative" aria-label={`Delete ${p.name}`}><Trash2 size={15}/></button></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{p.name}</h2><p className="mt-0.5 text-xs text-ink-soft">{p.breed || "Breed not set"}{p.sex ? ` · ${p.sex}` : ""}</p></div><div className="grid h-9 w-9 place-items-center rounded-xl bg-muted"><SpeciesIcon type={p.species}/></div></div>{p.birth_date && <p className="mt-3 text-xs text-ink-soft">Born {new Date(p.birth_date).toLocaleDateString()}</p>}{p.notes && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{p.notes}</p>}</div></Card>)}</div>}
    <PetDialog open={open} onOpenChange={setOpen} onCreate={async (data, file) => { try { const rec = await pb.collection("pets").create<Pet>({ ...data, user: pb.authStore.record!.id, ...(file ? { photo: file } : {}) }); setPets(x => [...x, rec].sort((a,b) => a.name.localeCompare(b.name))); setOpen(false); toast.success("Pet profile created"); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save pet"); } }}/>
  </div>;
}
function PetDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (v:boolean)=>void; onCreate: (data:Partial<Pet>, file?:File)=>void }) {
  const [name,setName]=useState(""); const [type,setType]=useState<PetSpecies>("Dog"); const [breed,setBreed]=useState(""); const [sex,setSex]=useState("Unknown"); const [birth,setBirth]=useState(""); const [notes,setNotes]=useState(""); const [file,setFile]=useState<File>();
  const reset=()=>{setName("");setType("Dog");setBreed("");setSex("Unknown");setBirth("");setNotes("");setFile(undefined)};
  return <Dialog open={open} onOpenChange={v=>{onOpenChange(v);if(!v)reset()}} title="Add pet profile"><div className="space-y-4"><div><Label>Pet name</Label><Input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Milo"/></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Type</Label><Select value={type} onValueChange={v=>setType(v as PetSpecies)}>{species.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</Select></div><div><Label>Sex</Label><Select value={sex} onValueChange={setSex}><SelectItem value="Unknown">Unknown</SelectItem><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></Select></div></div><div><Label>Breed</Label><Input value={breed} onChange={e=>setBreed(e.target.value)} placeholder="e.g. Golden Retriever"/></div><div><Label>Profile photo</Label><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line/15 bg-surface p-3 text-sm hover:bg-muted"><div className="grid h-10 w-10 place-items-center rounded-lg bg-muted"><Camera size={17}/></div><div className="min-w-0"><p className="font-medium">{file ? file.name : "Choose photo"}</p><p className="text-xs text-ink-soft">JPG, PNG or WEBP</p></div><input type="file" accept="image/*" className="hidden" onChange={e=>setFile(e.target.files?.[0])}/></label></div><div><Label>Birth date</Label><Input type="date" value={birth} onChange={e=>setBirth(e.target.value)}/></div><div><Label>Notes</Label><Textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Health notes, personality, vet reminders…"/></div><Button className="w-full" disabled={!name.trim()} onClick={()=>onCreate({name:name.trim(),species:type,breed:breed||undefined,sex,birth_date:birth||undefined,notes:notes||undefined},file)}>Create pet profile</Button></div></Dialog>;
}
