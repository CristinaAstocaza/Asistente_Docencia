export class ProviderPacing {
 private readonly next=new Map<string,number>();
 constructor(private readonly now=()=>Date.now(),private readonly wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))){}
 async acquire(bucket:string,perMinute:number){
  const current=this.now(),slot=Math.max(current,this.next.get(bucket)||0);
  this.next.set(bucket,slot+Math.ceil(60000/perMinute));
  if(slot>current)await this.wait(slot-current);
 }
}
export const providerPacing=new ProviderPacing();
