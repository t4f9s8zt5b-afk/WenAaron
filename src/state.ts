import type {AgentName,AgentStatus,Candidate,Decision,Trade} from './types.js';
export const agents: Record<AgentName,AgentStatus> = Object.fromEntries((['SCOUT','FILTER','ANALYST','SNIPER','GUARD','SCRIBE'] as AgentName[]).map(name=>[name,{name,state:'IDLE',message:'等待任务',updatedAt:new Date().toISOString()}])) as Record<AgentName,AgentStatus>;
export const candidates = new Map<string,Candidate>();
export const decisions: Decision[] = [];
export const trades: Trade[] = [];
export const equity: {at:string;value:number}[] = [{at:new Date().toISOString(),value:1000}];
export const events: {at:string;agent:string;level:string;message:string}[] = [];
export function setAgent(name:AgentName,state:AgentStatus['state'],message:string){agents[name]={name,state,message,updatedAt:new Date().toISOString()}; log(name,state,message);}
export function log(agent:string,level:string,message:string){events.unshift({at:new Date().toISOString(),agent,level,message}); if(events.length>500)events.length=500;}
