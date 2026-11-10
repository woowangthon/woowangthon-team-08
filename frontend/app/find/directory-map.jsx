"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Crosshair } from "lucide-react"
import "./find-page.css"

/**
 * 상담기관 찾기 화면의 지도 영역 (네이버 지도 JavaScript API v3).
 *
 * - 키: .env.local 의 NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
 * - items: 지도에 찍을 기관들. { id, name, tab, lat, lng } 가 있는 항목만 핀으로 표시해요.
 * - selectedId: 선택된 기관 (큰 핀으로 표시). 핀을 누르면 onSelect(id) 를 알려줘요.
 * - 핀에 마우스를 올리면 onHover(id), 벗어나면 onHover(null).
 * - fitKey: 이 값이 바뀌면(탭·검색·지역이 바뀌면) 지도가 현재 기관들이 다 보이게 이동해요.
 * - onViewportChange: 지도를 움직이고 멈출 때, 화면 안에 있는 기관 id 목록을 알려줘요(reportViewport 일 때만).
 * - onLocate: "내 위치" 버튼으로 위치를 얻었을 때 { lat, lng } 를 알려줘요. 위치는 저장·전송하지 않아요.
 */
const CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
const SCRIPT_URL = "https://oapi.map.naver.com/openapi/v3/maps.js"

// 화면 안에 이 개수 이하로 보이면 핀을 하나하나 보여주고, 넘으면 가까운 것끼리 묶어서 숫자로 보여줘요.
const MAX_SINGLE_PINS = 150
const CLUSTER_PX = 56
const FIT_PADDING = { top: 48, right: 48, bottom: 48, left: 48, maxZoom: 15 }
const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 }

// 스크립트는 한 번만 불러와요 (화면을 오가도 다시 불러오지 않게)
let scriptPromise = null
function loadNaverMaps() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  if (window.naver?.maps) return Promise.resolve(window.naver.maps)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      window.navermap_authFailure = () => reject(new Error("auth"))
      const script = document.createElement("script")
      script.src = `${SCRIPT_URL}?ncpKeyId=${encodeURIComponent(CLIENT_ID)}`
      script.async = true
      script.onload = () => resolve(window.naver.maps)
      script.onerror = () => reject(new Error("load"))
      document.head.appendChild(script)
    }).catch((error) => {
      scriptPromise = null
      throw error
    })
  }
  return scriptPromise
}

function pinHtml(item, selected) {
  const size = selected ? 30 : 22
  const kind = item.tab || "other"
  return {
    content: `<span class="dir-pin" data-kind="${kind}"${selected ? ' data-selected="true"' : ""} aria-hidden="true"></span>`,
    size: { width: size, height: size },
    anchor: { x: size / 2, y: size / 2 },
  }
}

function clusterHtml(count) {
  const size = count >= 100 ? 46 : count >= 10 ? 40 : 34
  return {
    content: `<span class="dir-cluster" style="width:${size}px;height:${size}px" aria-hidden="true">${count}</span>`,
    size: { width: size, height: size },
    anchor: { x: size / 2, y: size / 2 },
  }
}

export function DirectoryMap({
  className = "",
  items = [],
  selectedId = null,
  fitKey = "",
  hasCoordsInDb = true,
  reportViewport = false,
  onSelect,
  onHover,
  onViewportChange,
  onLocate,
}) {
  const canvasRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)
  const lastFitKeyRef = useRef(null)
  const renderRef = useRef(() => {})
  const handlersRef = useRef({})
  const [status, setStatus] = useState(CLIENT_ID ? "loading" : "nokey")
  const [locating, setLocating] = useState(false)
  const [locateMessage, setLocateMessage] = useState("")

  handlersRef.current = { onSelect, onHover, onViewportChange, reportViewport }

  const located = useMemo(
    () => items.filter((item) => item.lat !== null && item.lng !== null),
    [items],
  )

  // 1. 지도 만들기 (한 번만)
  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadNaverMaps()
      .then((maps) => {
        if (cancelled || !canvasRef.current) return
        window.navermap_authFailure = () => {
          if (!cancelled) setStatus("auth")
        }
        const map = new maps.Map(canvasRef.current, {
          center: new maps.LatLng(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng),
          zoom: 11,
        })
        mapRef.current = map
        maps.Event.addListener(map, "idle", () => renderRef.current())
        setStatus("ready")
      })
      .catch((error) => {
        if (!cancelled) setStatus(error.message === "auth" ? "auth" : "error")
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 지도 칸 크기가 바뀌면 지도도 다시 재요.
  useEffect(() => {
    const canvas = canvasRef.current
    if (status !== "ready" || !canvas || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => mapRef.current?.autoResize())
    observer.observe(canvas)
    mapRef.current?.autoResize()
    return () => observer.disconnect()
  }, [status])

  // 2. 핀 그리기: 화면 안 기관만, 많으면 묶어서
  const renderMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map || !window.naver?.maps) return
    const maps = window.naver.maps

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    const bounds = map.getBounds()
    const inView = located.filter((item) => bounds.hasLatLng(new maps.LatLng(item.lat, item.lng)))

    if (handlersRef.current.reportViewport) {
      handlersRef.current.onViewportChange?.(inView.map((item) => item.id))
    }

    const makePin = (item) => {
      const selected = item.id === selectedId
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(item.lat, item.lng),
        title: item.name,
        zIndex: selected ? 300 : 100,
        icon: (() => {
          const icon = pinHtml(item, selected)
          return {
            content: icon.content,
            size: new maps.Size(icon.size.width, icon.size.height),
            anchor: new maps.Point(icon.size.width / 2, icon.size.height / 2),
          }
        })(),
      })
      maps.Event.addListener(marker, "click", () => handlersRef.current.onSelect?.(item.id))
      maps.Event.addListener(marker, "mouseover", () => handlersRef.current.onHover?.(item.id))
      maps.Event.addListener(marker, "mouseout", () => handlersRef.current.onHover?.(null))
      markersRef.current.push(marker)
    }

    if (inView.length <= MAX_SINGLE_PINS) {
      inView.forEach(makePin)
      return
    }

    // 가까운 것끼리 묶기: 지도 줌 단계에 맞춰 격자 칸 크기를 정하고, 한 칸에 모인 기관을 하나로 묶어요.
    const zoom = map.getZoom()
    const cellLng = (CLUSTER_PX * 360) / (256 * 2 ** zoom)
    const cellLat = cellLng * Math.cos((37.5 * Math.PI) / 180)
    const cells = new Map()
    for (const item of inView) {
      if (item.id === selectedId) continue // 선택한 기관은 항상 따로 보여요
      const key = `${Math.floor(item.lat / cellLat)}:${Math.floor(item.lng / cellLng)}`
      const cell = cells.get(key)
      if (cell) cell.push(item)
      else cells.set(key, [item])
    }
    for (const group of cells.values()) {
      if (group.length === 1) {
        makePin(group[0])
        continue
      }
      const lat = group.reduce((sum, item) => sum + item.lat, 0) / group.length
      const lng = group.reduce((sum, item) => sum + item.lng, 0) / group.length
      const icon = clusterHtml(group.length)
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(lat, lng),
        title: `기관 ${group.length}곳`,
        zIndex: 50,
        icon: {
          content: icon.content,
          size: new maps.Size(icon.size.width, icon.size.height),
          anchor: new maps.Point(icon.size.width / 2, icon.size.height / 2),
        },
      })
      maps.Event.addListener(marker, "click", () => {
        // 묶음을 누르면 그 기관들이 다 보이게 확대해요.
        map.fitBounds(
          group.map((item) => new maps.LatLng(item.lat, item.lng)),
          { top: 60, right: 60, bottom: 60, left: 60, maxZoom: 17 },
        )
      })
      markersRef.current.push(marker)
    }
  }, [located, selectedId])

  useEffect(() => {
    renderRef.current = renderMarkers
    if (status === "ready") renderMarkers()
  }, [renderMarkers, status, reportViewport])

  // 3. 탭·검색·지역이 바뀌면, 해당 기관들이 한 화면에 다 보이게 이동
  useEffect(() => {
    const map = mapRef.current
    if (status !== "ready" || !map || located.length === 0) return
    if (lastFitKeyRef.current === fitKey) return
    lastFitKeyRef.current = fitKey
    const maps = window.naver.maps
    if (located.length === 1) {
      map.setCenter(new maps.LatLng(located[0].lat, located[0].lng))
      map.setZoom(15)
      return
    }
    map.fitBounds(
      located.map((item) => new maps.LatLng(item.lat, item.lng)),
      FIT_PADDING,
    )
  }, [fitKey, located, status])

  // 4. 선택한 기관으로 지도 이동
  useEffect(() => {
    const map = mapRef.current
    if (status !== "ready" || !map || !selectedId) return
    const selected = located.find((item) => item.id === selectedId)
    if (selected) map.panTo(new window.naver.maps.LatLng(selected.lat, selected.lng))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, status])

  // 5. "내 위치" 버튼: 누를 때만 브라우저가 위치 권한을 물어봐요.
  function locateMe() {
    const map = mapRef.current
    if (!map || locating) return
    if (!("geolocation" in navigator)) {
      setLocateMessage("이 브라우저에서는 위치를 확인할 수 없어요.")
      return
    }
    setLocating(true)
    setLocateMessage("")
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const maps = window.naver.maps
        const position = new maps.LatLng(coords.latitude, coords.longitude)
        if (userMarkerRef.current) {
          userMarkerRef.current.setPosition(position)
        } else {
          userMarkerRef.current = new maps.Marker({
            map,
            position,
            title: "내 위치",
            zIndex: 400,
            icon: {
              content: '<span class="dir-me-dot" aria-hidden="true"></span>',
              size: new maps.Size(18, 18),
              anchor: new maps.Point(9, 9),
            },
          })
        }
        map.setCenter(position)
        map.setZoom(15)
        onLocate?.({ lat: coords.latitude, lng: coords.longitude })
        setLocating(false)
      },
      (error) => {
        setLocateMessage(
          error.code === 1
            ? "위치 권한이 꺼져 있어요. 브라우저 설정에서 허용하면 내 주변을 볼 수 있어요."
            : error.code === 3
              ? "위치를 확인하는 데 시간이 걸리고 있어요. 잠시 뒤 다시 눌러 주세요."
              : "내 위치를 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
        )
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  useEffect(() => {
    if (!locateMessage) return
    const timer = setTimeout(() => setLocateMessage(""), 6000)
    return () => clearTimeout(timer)
  }, [locateMessage])

  const note = {
    nokey: ["지도 키가 아직 없어요", "NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 를 .env.local 에 넣어 주세요."],
    auth: ["지도 인증에 실패했어요", "클라이언트 ID와 등록한 사이트 주소(localhost 포함)를 확인해 주세요."],
    error: ["지도를 불러오지 못했어요", "잠시 뒤 다시 시도해 주세요."],
    loading: ["지도를 불러오는 중이에요", ""],
    nocoords: ["기관 위치를 아직 준비하지 못했어요", "좌표가 저장되면 이곳에 핀으로 표시돼요."],
    empty: ["이 조건에는 지도에 표시할 위치가 없어요", "조건을 바꾸면 다시 표시돼요."],
  }[status !== "ready" ? status : !hasCoordsInDb ? "nocoords" : located.length === 0 ? "empty" : ""]

  return (
    <div className={`dir-map ${className}`}>
      <div ref={canvasRef} id="directory-map" className="dir-map-canvas" />
      {status === "ready" && (
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          aria-label="내 위치로 이동"
          title="내 위치로 이동"
          className="dir-locate focus-ring"
        >
          <Crosshair aria-hidden="true" data-busy={locating || undefined} />
        </button>
      )}
      {locateMessage && (
        <p role="status" className="dir-locate-msg">
          {locateMessage}
        </p>
      )}
      {note && (
        <div className="dir-map-note">
          <p>
            <strong>{note[0]}</strong>
            {note[1]}
          </p>
        </div>
      )}
    </div>
  )
}
