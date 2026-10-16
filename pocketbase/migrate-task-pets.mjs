import PocketBase from 'pocketbase';
const pb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8090');
if (!process.env.PB_SUPERUSER_EMAIL || !process.env.PB_SUPERUSER_PASSWORD) throw new Error('Set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD.');
await pb.collection('_superusers').authWithPassword(process.env.PB_SUPERUSER_EMAIL, process.env.PB_SUPERUSER_PASSWORD);
const users = await pb.collections.getOne('users');
const tasks = await pb.collections.getOne('life_planner');
const add = (fields,name,type='text',extra={}) => { if (!fields.some(f=>f.name===name)) fields.push({name,type,...extra}); };
add(tasks.fields,'list'); add(tasks.fields,'tags'); add(tasks.fields,'recurrence'); add(tasks.fields,'remind_at','date'); add(tasks.fields,'parent_task');
const status = tasks.fields.find(f=>f.name==='status'); if(status) status.values=['Inbox','To-Do','In Progress','Done'];
await pb.collections.update(tasks.id, tasks);
let pets; try { pets = await pb.collections.getOne('pets'); } catch {
  pets = await pb.collections.create({ name:'pets', type:'base', listRule:'user = @request.auth.id', viewRule:'user = @request.auth.id', createRule:'@request.auth.id != "" && user = @request.auth.id', updateRule:'user = @request.auth.id', deleteRule:'user = @request.auth.id', fields:[
    {name:'user',type:'relation',required:true,collectionId:users.id,maxSelect:1,cascadeDelete:true},{name:'name',type:'text',required:true,max:80},{name:'species',type:'select',required:true,values:['Dog','Cat','Bird','Fish','Rabbit','Other'],maxSelect:1},{name:'breed',type:'text'},{name:'sex',type:'select',values:['Unknown','Male','Female'],maxSelect:1},{name:'birth_date',type:'date'},{name:'photo',type:'file',maxSelect:1,maxSize:5242880,mimeTypes:['image/jpeg','image/png','image/webp']},{name:'notes',type:'text'}
  ]}); console.log('created pets');
}
try { const expenses=await pb.collections.getOne('expenses'); add(expenses.fields,'pet','relation',{collectionId:pets.id,maxSelect:1}); await pb.collections.update(expenses.id,expenses); } catch(e){ console.log('expense pet relation skipped:', e.message); }
console.log('Migration complete.');
