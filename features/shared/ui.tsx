"use client";

import { AudioLines, Radio, Search, X } from "lucide-react";
import { COLORS, minutes, RadioBlock, RadioData, WEEK_DAYS } from "@/domain/radio";

export function Metric({ icon: Icon, tone, label, value, detail }: { icon: typeof Radio; tone: string; label: string; value: string; detail: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={22}/></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}
export function PageTitle({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action:React.ReactNode}) {
  return <section className="page-title"><div><div className="eyebrow">{eyebrow}<span className="eyebrow-line"/></div><h1>{title}</h1><p>{description}</p></div>{action}</section>;
}
export function SearchBox({value,onChange,placeholder}:{value:string;onChange:(value:string)=>void;placeholder:string}) {
  return <label className="search-box"><Search size={17}/><input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}/></label>;
}
export function EmptyState({title,text}:{title:string;text:string}) {
  return <div className="empty-state"><div><AudioLines size={22}/></div><b>{title}</b><p>{text}</p></div>;
}

export function WeekTimeline({blocks,playlists,onDay,today,selected}:{blocks:RadioBlock[];playlists:RadioData["playlists"];onDay:(day:number)=>void;today:number;selected?:number}) {
  const ticks = [0,4,8,12,16,20,24];
  return <div className="week-timeline">
    <div className="timeline-header"><span>DÍA</span><div className="timeline-ticks">{ticks.map((hour)=><span key={hour}>{String(hour).padStart(2,"0")}:00</span>)}</div></div>
    {WEEK_DAYS.map((day,index)=>{
      const segments = blocks.flatMap((block)=>{
        const start = minutes(block.start), end = minutes(block.end);
        const parts:{start:number;end:number;playlistId:string;title:string}[]=[];
        if(block.day===index) parts.push({start,end:end>start?end:1440,playlistId:block.playlistId,title:block.title});
        if(end<=start&&(block.day+1)%7===index) parts.push({start:0,end,playlistId:block.playlistId,title:`${block.title} (continuación)`});
        return parts;
      });
      return <button className={`timeline-row ${index===today?"today":""} ${selected===index?"selected":""}`} key={day} onClick={()=>onDay(index)}>
        <span className="timeline-day">{day.slice(0,3)}{today===index&&<i/>}</span>
        <div className="timeline-track"><div className="timeline-gridlines">{ticks.slice(1,-1).map(hour=><i key={hour} style={{left:`${hour/24*100}%`}}/>)}</div>{segments.map((s,i)=>{const playlist=playlists.find(p=>p.id===s.playlistId);return <span key={i} title={`${s.title} · ${Math.floor(s.start/60)}:${String(s.start%60).padStart(2,"0")}`} className="timeline-segment" style={{left:`${s.start/1440*100}%`,width:`${Math.max(0.5,(s.end-s.start)/1440*100)}%`,background:playlist?.color||COLORS[0]}}/>;})}</div>
      </button>;
    })}
  </div>;
}

export function ModalFrame({title,subtitle,onClose,children}:{title:string;subtitle:string;onClose:()=>void;children:React.ReactNode}) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e)=>e.stopPropagation()}><div className="modal-head"><div><span className="section-kicker">ONDAPILOT STUDIO</span><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={21}/></button></div>{children}</div></div>;
}
