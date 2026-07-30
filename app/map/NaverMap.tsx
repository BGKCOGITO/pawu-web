"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

declare global { interface Window { naver: any; } }

type Hospital = {
  id:number; name:string; address:string; phone:string|null; latitude:number; longitude:number;
  reservation_enabled:boolean; parking_available?:boolean|null; night_care_available?:boolean|null;
  emergency_care_available?:boolean|null; is_active:boolean; source_type:"public_data"|"pawu_partner";
};
type Location = { latitude:number; longitude:number };
type ViewMode = "list" | "map";
type SortMode = "distance" | "name";

const SELECT_COLUMNS = "id,name,address,phone,latitude,longitude,reservation_enabled,parking_available,night_care_available,emergency_care_available,is_active,source_type";
const filterOptions = [
  { code:"reservation", label:"예약 가능" },
  { code:"night", label:"야간 진료" },
  { code:"emergency", label:"응급 진료" },
  { code:"parking", label:"주차 가능" },
  { code:"partner", label:"PAWU 병원" },
];

function distanceKm(from:Location, hospital:Hospital) {
  const rad=(v:number)=>(v*Math.PI)/180;
  const dLat=rad(hospital.latitude-from.latitude);
  const dLon=rad(hospital.longitude-from.longitude);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(from.latitude))*Math.cos(rad(hospital.latitude))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function markerHtml(hospital:Hospital, selected:boolean) {
  const bg=selected?"#ff725e":hospital.source_type==="pawu_partner"?"#183d35":"#8d9692";
  return `<div style="width:${selected?38:31}px;height:${selected?38:31}px;border-radius:12px 12px 12px 4px;transform:rotate(-45deg);background:${bg};border:2px solid white;box-shadow:0 4px 14px rgba(24,61,53,.24);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:white;font-size:12px;font-weight:900">P</span></div>`;
}
function navigationUrls(hospital:Hospital) {
  const name=encodeURIComponent(hospital.name); const address=encodeURIComponent(hospital.address||hospital.name);
  const lat=hospital.latitude; const lng=hospital.longitude;
  return {
    naver:`https://map.naver.com/p/directions/-/-/${lng},${lat},${name}/-/car`,
    kakao:`https://map.kakao.com/link/to/${name},${lat},${lng}`,
    tmap:`https://apis.openapi.sk.com/tmap/app/routes?appKey=&name=${name}&lon=${lng}&lat=${lat}`,
    search:`https://map.naver.com/p/search/${name}%20${address}`,
  };
}

export default function NaverMap() {
  const mapElement=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<any>(null);
  const markersRef=useRef<any[]>([]);
  const currentLocationMarkerRef=useRef<any|null>(null);
  const currentLocationCircleRef=useRef<any|null>(null);
  const [hospitals,setHospitals]=useState<Hospital[]>([]);
  const [query,setQuery]=useState("");
  const [filters,setFilters]=useState<string[]>([]);
  const [location,setLocation]=useState<Location|null>(null);
  const [locationAccuracy,setLocationAccuracy]=useState<number|null>(null);
  const [view,setView]=useState<ViewMode>("list");
  const [sort,setSort]=useState<SortMode>("distance");
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [scriptLoaded,setScriptLoaded]=useState(false);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("내 위치를 확인하면 가까운 병원부터 보여드려요.");
  const clientId=process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

  useEffect(()=>{
    let mounted=true;
    async function load(){
      const {data,error}=await supabase.from("hospitals").select(SELECT_COLUMNS).eq("is_active",true).not("latitude","is",null).not("longitude","is",null).limit(12000);
      if(!mounted)return;
      if(error)setMessage("병원 정보를 불러오지 못했습니다.");
      else setHospitals(((data??[]) as Hospital[]).filter(h=>Number.isFinite(Number(h.latitude))&&Number.isFinite(Number(h.longitude))));
      setLoading(false);
    }
    void load();
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        if(!mounted)return;
        setLocation({latitude:pos.coords.latitude,longitude:pos.coords.longitude});
        setLocationAccuracy(Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null);
        setMessage("현재 위치에서 가까운 순서로 정렬했어요.");
      },()=>setMessage("위치 권한이 없어 병원명 순으로 보여드려요."),{enableHighAccuracy:false,timeout:6000,maximumAge:300000});
    }
    return()=>{mounted=false};
  },[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const rows=hospitals.filter(h=>{
      if(q&&!`${h.name} ${h.address}`.toLowerCase().includes(q))return false;
      if(filters.includes("reservation")&&!h.reservation_enabled)return false;
      if(filters.includes("night")&&!h.night_care_available)return false;
      if(filters.includes("emergency")&&!h.emergency_care_available)return false;
      if(filters.includes("parking")&&!h.parking_available)return false;
      if(filters.includes("partner")&&h.source_type!=="pawu_partner")return false;
      return true;
    });
    return rows.sort((a,b)=>{
      if(sort==="distance"&&location)return distanceKm(location,a)-distanceKm(location,b);
      return a.name.localeCompare(b.name,"ko");
    });
  },[hospitals,query,filters,sort,location]);

  const selected=useMemo(()=>filtered.find(h=>h.id===selectedId)??hospitals.find(h=>h.id===selectedId)??null,[filtered,hospitals,selectedId]);

  useEffect(()=>{
    if(view!=="map"||!scriptLoaded||!mapElement.current||!window.naver)return;
    if(!mapRef.current){
      const center=location??{latitude:37.5665,longitude:126.978};
      mapRef.current=new window.naver.maps.Map(mapElement.current,{center:new window.naver.maps.LatLng(center.latitude,center.longitude),zoom:location?13:10,zoomControl:true});
    }
    markersRef.current.forEach(marker=>marker.setMap(null));
    markersRef.current=filtered.slice(0,300).map(h=>{
      const marker=new window.naver.maps.Marker({
        position:new window.naver.maps.LatLng(h.latitude,h.longitude),map:mapRef.current,
        icon:{content:markerHtml(h,h.id===selectedId),size:new window.naver.maps.Size(40,40),anchor:new window.naver.maps.Point(20,38)},
      });
      window.naver.maps.Event.addListener(marker,"click",()=>{setSelectedId(h.id);mapRef.current.panTo(new window.naver.maps.LatLng(h.latitude,h.longitude));});
      return marker;
    });

    if(location){
      const position=new window.naver.maps.LatLng(location.latitude,location.longitude);
      if(!currentLocationMarkerRef.current){
        currentLocationMarkerRef.current=new window.naver.maps.Marker({
          position,
          map:mapRef.current,
          zIndex:1000,
          icon:{
            content:`<div aria-label="현재 위치" style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center"><span style="position:absolute;width:34px;height:34px;border-radius:999px;background:rgba(53,132,255,.20);animation:pawuLocationPulse 1.8s ease-out infinite"></span><span style="position:relative;width:18px;height:18px;border-radius:999px;background:#3584ff;border:4px solid #fff;box-shadow:0 3px 12px rgba(23,72,145,.35)"></span></div><style>@keyframes pawuLocationPulse{0%{transform:scale(.7);opacity:1}100%{transform:scale(1.5);opacity:0}}</style>`,
            size:new window.naver.maps.Size(34,34),
            anchor:new window.naver.maps.Point(17,17),
          },
        });
      }else{
        currentLocationMarkerRef.current.setMap(mapRef.current);
        currentLocationMarkerRef.current.setPosition(position);
      }

      if(locationAccuracy&&locationAccuracy>0){
        if(!currentLocationCircleRef.current){
          currentLocationCircleRef.current=new window.naver.maps.Circle({
            map:mapRef.current,
            center:position,
            radius:Math.min(Math.max(locationAccuracy,20),500),
            strokeColor:"#3584ff",
            strokeOpacity:.55,
            strokeWeight:1,
            fillColor:"#6aa6ff",
            fillOpacity:.12,
            clickable:false,
            zIndex:10,
          });
        }else{
          currentLocationCircleRef.current.setMap(mapRef.current);
          currentLocationCircleRef.current.setCenter(position);
          currentLocationCircleRef.current.setRadius(Math.min(Math.max(locationAccuracy,20),500));
        }
      }
    }
  },[view,scriptLoaded,filtered,selectedId,location,locationAccuracy]);

  useEffect(()=>{
    if(view!=="map"||!mapRef.current)return;
    const refresh=()=>{
      if(typeof mapRef.current?.refresh==="function")mapRef.current.refresh();
      if(location&&window.naver?.maps){
        mapRef.current.setCenter(new window.naver.maps.LatLng(location.latitude,location.longitude));
      }
    };
    const first=window.requestAnimationFrame(refresh);
    const timer=window.setTimeout(refresh,180);
    return()=>{window.cancelAnimationFrame(first);window.clearTimeout(timer);};
  },[view,location]);

  function locate(){
    if(!navigator.geolocation){setMessage("현재 위치 기능을 사용할 수 없습니다.");return;}
    setMessage("현재 위치를 찾고 있어요.");
    navigator.geolocation.getCurrentPosition(pos=>{
      const next={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
      setLocation(next);
      setLocationAccuracy(Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null);
      setSort("distance");setMessage("파란 점이 현재 위치예요. 가까운 병원부터 정렬했어요.");
      if(mapRef.current&&window.naver){mapRef.current.setCenter(new window.naver.maps.LatLng(next.latitude,next.longitude));mapRef.current.setZoom(13);}
    },error=>{
      if(error.code===error.PERMISSION_DENIED)setMessage("위치 권한이 꺼져 있습니다. 브라우저 설정에서 허용해 주세요.");
      else if(error.code===error.TIMEOUT)setMessage("현재 위치 확인 시간이 초과됐습니다. 다시 눌러 주세요.");
      else setMessage("현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    },{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  }
  function toggle(code:string){setFilters(current=>current.includes(code)?current.filter(v=>v!==code):[...current,code]);}
  function selectHospital(hospital:Hospital){setSelectedId(hospital.id);if(view==="map"&&mapRef.current&&window.naver){mapRef.current.setCenter(new window.naver.maps.LatLng(hospital.latitude,hospital.longitude));mapRef.current.setZoom(15);}}

  return (
    <main className="min-h-[calc(100dvh-74px)] bg-[#f7f5ef] pb-28 text-[#183d35]">
      {clientId&&<Script id="naver-map-sdk-v102" src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`} strategy="afterInteractive" onLoad={()=>setScriptLoaded(true)} onReady={()=>setScriptLoaded(true)}/>} 
      <header className="sticky top-0 z-40 border-b border-[#e9e4d8] bg-[#fffdf8]/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf1ed] text-2xl font-black">‹</Link>
            <div className="min-w-0 flex-1"><p className="text-[10px] font-black tracking-[.18em] text-[#ff725e]">PAWU NEARBY</p><h1 className="text-xl font-black">병원 찾기</h1></div>
            <button type="button" onClick={()=>setView(view==="list"?"map":"list")} className="flex h-11 items-center gap-2 rounded-2xl bg-[#183d35] px-4 text-sm font-black text-white"><span>{view==="list"?"⌖":"☷"}</span>{view==="list"?"지도":"목록"}</button>
          </div>
          <div className="mt-3 flex items-center rounded-2xl border border-[#e2ddd1] bg-white px-3"><span className="text-lg">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="병원명 또는 지역 검색" className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm font-bold outline-none"/>{query&&<button onClick={()=>setQuery("")} className="text-xs font-black text-[#7c8581]">지우기</button>}</div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <button onClick={locate} className="shrink-0 rounded-full bg-[#e3f1eb] px-4 py-2 text-xs font-black text-[#23725e]">◎ 내 위치</button>
            <button onClick={()=>setSort(sort==="distance"?"name":"distance")} className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-black shadow-sm">{sort==="distance"?"거리순 ▾":"이름순 ▾"}</button>
            {filterOptions.map(item=><button key={item.code} onClick={()=>toggle(item.code)} className={filters.includes(item.code)?"shrink-0 rounded-full bg-[#ff725e] px-4 py-2 text-xs font-black text-white":"shrink-0 rounded-full bg-white px-4 py-2 text-xs font-black shadow-sm"}>{item.label}</button>)}
          </div>
        </div>
      </header>

      <section className={view === "list" ? "mx-auto max-w-6xl px-4 py-5" : "hidden"}>
        <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-sm font-black">가까운 병원부터</p><p className="mt-1 text-xs text-[#76807b]">{message}</p></div><span className="rounded-full bg-[#e8f3ed] px-3 py-1 text-xs font-black text-[#23725e]">{filtered.length.toLocaleString()}곳</span></div>
        {loading?<div className="rounded-3xl bg-white p-10 text-center text-sm font-bold text-[#7a847f]">병원을 찾는 중이에요.</div>:filtered.length===0?<div className="rounded-3xl bg-white p-10 text-center text-sm font-bold text-[#7a847f]">조건에 맞는 병원이 없습니다.</div>:
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{filtered.slice(0,300).map(h=>{
          const distance=location?distanceKm(location,h):null;
          return <article key={h.id} className="overflow-hidden rounded-[26px] border border-[#e8e2d6] bg-[#fffdf8] shadow-[0_10px_30px_rgba(30,58,50,.08)]">
            <button type="button" onClick={()=>selectHospital(h)} className="block w-full p-5 text-left active:bg-[#faf7f0]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {h.source_type==="pawu_partner"&&<span className="rounded-full bg-[#e2f2eb] px-2.5 py-1 text-[10px] font-black text-[#23725e]">PAWU 인증</span>}
                    {h.reservation_enabled&&<span className="rounded-full bg-[#fff0ec] px-2.5 py-1 text-[10px] font-black text-[#db5a49]">온라인 예약</span>}
                  </div>
                  <h2 className="mt-3 break-keep text-[18px] font-black leading-6 text-[#183d35]">{h.name}</h2>
                </div>
                {distance!==null&&<strong className="shrink-0 rounded-full bg-[#fff4ef] px-2.5 py-1 text-xs font-black text-[#ef6c57]">{distance.toFixed(1)}km</strong>}
              </div>

              <div className="mt-4 rounded-2xl bg-[#f7f5ef] p-3.5">
                <div className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 text-sm">⌖</span>
                  <p className="break-keep text-[13px] font-bold leading-5 text-[#68736d]">{h.address}</p>
                </div>
                <div className="mt-2 flex items-center gap-2.5">
                  <span aria-hidden="true" className="text-sm">☎</span>
                  <p className="text-[13px] font-bold text-[#68736d]">{h.phone || "전화번호 정보 없음"}</p>
                </div>
              </div>

              <div className="mt-4 flex min-h-7 flex-wrap gap-2">
                {h.night_care_available&&<span className="rounded-full border border-[#dfe8e3] bg-white px-3 py-1.5 text-[11px] font-black text-[#365f54]">야간 진료</span>}
                {h.emergency_care_available&&<span className="rounded-full border border-[#f4d9d1] bg-[#fff8f5] px-3 py-1.5 text-[11px] font-black text-[#c85b49]">응급 진료</span>}
                {h.parking_available&&<span className="rounded-full border border-[#e2ddd1] bg-white px-3 py-1.5 text-[11px] font-black text-[#5f6964]">주차 가능</span>}
                {!h.night_care_available&&!h.emergency_care_available&&!h.parking_available&&<span className="text-[11px] font-bold text-[#9aa19d]">등록된 편의 정보가 없습니다.</span>}
              </div>
            </button>

            <div className="border-t border-[#ece7dc] bg-white p-3">
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/hospital/${h.id}`} className="flex min-h-12 items-center justify-center rounded-2xl bg-[#183d35] px-3 text-sm font-black text-white">병원 상세</Link>
                {h.reservation_enabled
                  ? <Link href={`/hospital/${h.id}`} className="flex min-h-12 items-center justify-center rounded-2xl bg-[#ff725e] px-3 text-sm font-black text-white">예약하기</Link>
                  : <span className="flex min-h-12 items-center justify-center rounded-2xl bg-[#efede7] px-3 text-sm font-bold text-[#9a9f9c]">예약 미지원</span>}
                {h.phone
                  ? <a href={`tel:${h.phone}`} className="flex min-h-12 items-center justify-center rounded-2xl bg-[#edf2ef] px-3 text-sm font-black text-[#183d35]">전화하기</a>
                  : <span className="flex min-h-12 items-center justify-center rounded-2xl bg-[#efede7] px-3 text-sm font-bold text-[#aaa]">전화 없음</span>}
                <button type="button" onClick={()=>setSelectedId(h.id)} className="min-h-12 rounded-2xl border border-[#f1d8d1] bg-[#fff5f1] px-3 text-sm font-black text-[#d95d4c]">길찾기</button>
              </div>
            </div>
          </article>})}</div>}
      </section>

      <section
        aria-hidden={view !== "map"}
        className={view === "map" ? "relative h-[calc(100dvh-250px)] min-h-[520px] w-full overflow-hidden bg-[#dfe8e3]" : "hidden"}
      >
        <div ref={mapElement} className="absolute inset-0 h-full w-full" />
        {location&&<div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-3 py-2 text-xs font-black text-[#183d35] shadow-lg backdrop-blur"><span className="h-3 w-3 rounded-full border-[3px] border-white bg-[#3584ff] shadow-[0_1px_5px_rgba(53,132,255,.55)]"/>현재 위치</div>}
        {!clientId&&<div className="absolute inset-0 flex items-center justify-center p-6"><div className="rounded-3xl bg-white p-6 text-center shadow-xl"><strong>지도 설정이 필요합니다.</strong><p className="mt-2 text-sm text-[#777]">네이버 지도 Client ID를 확인해 주세요.</p></div></div>}
      </section>

      {selected&&(
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={()=>setSelectedId(null)}>
          <div className="w-full max-w-md rounded-[28px] bg-[#fffdf8] p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black tracking-[.16em] text-[#ff725e]">NAVIGATION</p><h2 className="mt-2 text-xl font-black">{selected.name}</h2><p className="mt-2 text-sm leading-6 text-[#747e79]">{selected.address}</p></div><button onClick={()=>setSelectedId(null)} className="rounded-full bg-[#eeeae1] px-3 py-1.5 font-black">×</button></div>
            <p className="mt-5 text-xs font-black text-[#68736d]">사용할 지도를 선택하세요.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(navigationUrls(selected)).slice(0,3).map(([key,url])=><a key={key} href={url} target="_blank" rel="noreferrer" className="rounded-2xl border border-[#ddd8cc] bg-white px-4 py-4 text-center text-sm font-black">{key==="naver"?"네이버 지도":key==="kakao"?"카카오맵":"티맵"}</a>)}<Link href={`/hospital/${selected.id}`} className="rounded-2xl bg-[#183d35] px-4 py-4 text-center text-sm font-black text-white">병원 상세</Link></div>
          </div>
        </div>
      )}
    </main>
  );
}
