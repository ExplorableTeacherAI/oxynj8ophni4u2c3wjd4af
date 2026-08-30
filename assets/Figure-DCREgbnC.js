import{o as d,u as w,d as y,r as F,j as e,R as j,t as k}from"./index-DZlUPqF3.js";import{P as E,a as C}from"./play-Bdai0C38.js";const h=d("flex h-7 w-7 items-center justify-center rounded-lg","bg-white/90 text-[#64748B] transition-colors","hover:bg-slate-50 hover:text-slate-800","focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"),B=({id:t,caption:r,onReset:a,playable:i=!1,playVarName:n,aspectRatio:l,children:o,className:c})=>{const g=w(),x=y(n??"",!1),[b,u]=F.useState(!1),s=n?!!x:b,f=()=>{n?g(n,!s):u(v=>!v)},p=i||!!a;return e.jsxs("figure",{"data-figure-id":t,className:d("group mx-auto w-full max-w-[560px]",c),children:[e.jsxs("div",{className:"relative w-full overflow-hidden rounded-xl bg-white",style:l?{aspectRatio:l}:void 0,children:[o,p&&e.jsxs("div",{className:d("absolute right-2 top-2 z-10 flex items-center gap-1","opacity-0 transition-opacity duration-150","focus-within:opacity-100 group-hover:opacity-100","[@media(pointer:coarse)]:opacity-100"),children:[i&&e.jsx("button",{type:"button","aria-label":s?"Pause":"Play","aria-pressed":s,"data-figure-control":"play",onClick:f,className:h,children:s?e.jsx(E,{className:"h-3.5 w-3.5"}):e.jsx(C,{className:"h-3.5 w-3.5"})}),a&&e.jsx("button",{type:"button","aria-label":"Reset figure","data-figure-control":"reset",onClick:a,className:h,children:e.jsx(j,{className:"h-3.5 w-3.5"})})]})]}),r&&e.jsx("figcaption",{className:"mt-2 px-1 text-[13px] leading-snug text-[#64748B]",children:r})]})},m="figure-slider-styles",S=`
.figure-slider {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 9999px;
    background: #E2E8F0;
    outline: none;
}
.figure-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--figure-slider-accent, #62D0AD);
    border: 2px solid #FFFFFF;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);
    cursor: grab;
    transition: transform 150ms cubic-bezier(0.33, 1, 0.68, 1);
}
.figure-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
.figure-slider::-webkit-slider-thumb:active { cursor: grabbing; }
.figure-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--figure-slider-accent, #62D0AD);
    border: 2px solid #FFFFFF;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);
    cursor: grab;
    transition: transform 150ms cubic-bezier(0.33, 1, 0.68, 1);
}
.figure-slider::-moz-range-thumb:hover { transform: scale(1.15); }
.figure-slider::-moz-range-thumb:active { cursor: grabbing; }
.figure-slider:focus-visible {
    box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.5);
}
`;function D(){if(typeof document>"u"||document.getElementById(m))return;const t=document.createElement("style");t.id=m,t.textContent=S,document.head.appendChild(t)}const z=({id:t,varName:r,defaultValue:a,min:i=0,max:n=100,step:l=1,label:o,formatValue:c,color:g,className:x})=>{const b=w(),u=y(r,a??i),s=typeof u=="number"?u:a??i,f=k(r,g??"#62D0AD");return F.useEffect(()=>{D()},[]),e.jsxs("label",{id:t,className:d("flex w-full items-center gap-3 text-xs text-[#64748B]",x),children:[o&&e.jsx("span",{className:"shrink-0",children:o}),e.jsx("input",{type:"range",className:"figure-slider min-w-0 flex-1",style:{"--figure-slider-accent":f},min:i,max:n,step:l,value:s,"aria-label":o??r,onChange:p=>b(r,Number(p.target.value))}),e.jsx("span",{className:"shrink-0 text-right text-slate-700",style:{fontVariantNumeric:"tabular-nums"},children:c?c(s):s})]})};export{B as F,z as a};
