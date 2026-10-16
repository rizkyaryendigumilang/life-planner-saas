import { FormEvent, useState } from "react";
import { pb } from "../lib/pocketbase";
import { Button, Input, Label } from "../components/ui";
import { toast } from "sonner";

export function ChangePassword({onDone}:{onDone:()=>void}){
 const [current,setCurrent]=useState("");const [next,setNext]=useState("");const [confirm,setConfirm]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();if(next.length<10)return toast.error("Use at least 10 characters.");if(next!==confirm)return toast.error("Passwords do not match.");setBusy(true);try{await pb.collection("users").update(pb.authStore.record!.id,{oldPassword:current,password:next,passwordConfirm:confirm,is_password_temp:false});toast.success("Password updated");onDone();}catch(err){toast.error(err instanceof Error?err.message:"Could not update password.");}finally{setBusy(false);}}
 return <div className="min-h-screen grid place-items-center bg-muted p-5"><div className="w-full max-w-md rounded-2xl border border-line/15 bg-surface p-6 shadow-sm"><p className="text-xs uppercase tracking-[.18em] text-ink-soft">First sign-in</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Create your password</h1><p className="mt-2 text-sm text-ink-soft">Your temporary password must be replaced before you can use the workspace.</p><form onSubmit={submit} className="mt-7 space-y-4"><div><Label>Temporary password</Label><Input type="password" value={current} onChange={e=>setCurrent(e.target.value)} required/></div><div><Label>New password</Label><Input type="password" value={next} onChange={e=>setNext(e.target.value)} required/></div><div><Label>Confirm new password</Label><Input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/></div><Button className="w-full" disabled={busy}>{busy?"Saving…":"Set password"}</Button></form></div></div>
}
