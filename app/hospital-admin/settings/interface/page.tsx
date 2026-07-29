"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import {
  FEATURE_GROUP_LABELS,
  HOSPITAL_FEATURES,
  HOSPITAL_WIDGETS,
} from "../../../../lib/hospital-interface-config";

type FeatureRow = {
  key: string;
  isEnabled: boolean;
};

type WidgetRow = {
  key: string;
  isVisible: boolean;
  size: "small" | "medium" | "large";
};

type FeatureSetting = {
  feature_key: string;
  is_enabled: boolean;
  sort_order: number;
};

type WidgetSetting = {
  widget_key: string;
  is_visible: boolean;
  sort_order: number;
  widget_size: "small" | "medium" | "large";
};

export default function InterfaceSettingsPage() {
  const [tab, setTab] = useState<"features" | "widgets">("features");
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [widgets, setWidgets] = useState<WidgetRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function accessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    const token = await accessToken();
    if (!token) return;

    const response = await fetch("/api/hospital/interface-settings", {
      headers: { authorization: `Bearer ${token}` },
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message ?? "화면 설정을 불러오지 못했습니다.");
      return;
    }

    const featureSettings = new Map<string, FeatureSetting>(
      ((result.features ?? []) as FeatureSetting[]).map((item) => [
        item.feature_key,
        item,
      ]),
    );

    const orderedFeatures = [...HOSPITAL_FEATURES]
      .sort((a, b) => {
        const aOrder = Number(featureSettings.get(a.key)?.sort_order ?? 9999);
        const bOrder = Number(featureSettings.get(b.key)?.sort_order ?? 9999);
        return aOrder - bOrder;
      })
      .map((item) => ({
        key: item.key,
        isEnabled:
          featureSettings.get(item.key)?.is_enabled ?? item.defaultEnabled,
      }));

    const widgetSettings = new Map<string, WidgetSetting>(
      ((result.widgets ?? []) as WidgetSetting[]).map((item) => [
        item.widget_key,
        item,
      ]),
    );

    const orderedWidgets = [...HOSPITAL_WIDGETS]
      .sort((a, b) => {
        const aOrder = Number(widgetSettings.get(a.key)?.sort_order ?? 9999);
        const bOrder = Number(widgetSettings.get(b.key)?.sort_order ?? 9999);
        return aOrder - bOrder;
      })
      .map((item) => ({
        key: item.key,
        isVisible:
          widgetSettings.get(item.key)?.is_visible ?? item.defaultVisible,
        size: widgetSettings.get(item.key)?.widget_size ?? item.size,
      }));

    setCanManage(result.canManage === true);
    setFeatures(orderedFeatures);
    setWidgets(orderedWidgets);
  }

  useEffect(() => {
    void load();
  }, []);

  function moveFeature(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= features.length) return;

    const next = [...features];
    [next[index], next[target]] = [next[target], next[index]];
    setFeatures(next);
  }

  function moveWidget(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= widgets.length) return;

    const next = [...widgets];
    [next[index], next[target]] = [next[target], next[index]];
    setWidgets(next);
  }

  async function save(type: "features" | "widgets") {
    setSaving(true);
    setMessage("");

    const token = await accessToken();
    if (!token) {
      setSaving(false);
      return;
    }

    const response = await fetch("/api/hospital/interface-settings", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type,
        items: type === "features" ? features : widgets,
      }),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(result.message ?? "설정을 저장하지 못했습니다.");
      return;
    }

    setMessage(
      type === "features"
        ? "병원 메뉴 설정을 저장했습니다."
        : "대시보드 위젯 설정을 저장했습니다.",
    );

    window.dispatchEvent(new Event("pawu-interface-settings-updated"));
  }

  async function reset() {
    if (!window.confirm("병원 메뉴와 대시보드를 기본 설정으로 되돌릴까요?")) {
      return;
    }

    setSaving(true);
    const token = await accessToken();

    if (!token) {
      setSaving(false);
      return;
    }

    const response = await fetch("/api/hospital/interface-settings", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type: "reset" }),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(result.message ?? "기본값으로 복원하지 못했습니다.");
      return;
    }

    setMessage("기본 설정으로 복원했습니다.");
    await load();
    window.dispatchEvent(new Event("pawu-interface-settings-updated"));
  }

  const featureDefinitionMap = useMemo(
    () => new Map(HOSPITAL_FEATURES.map((item) => [item.key, item])),
    [],
  );

  const widgetDefinitionMap = useMemo(
    () => new Map(HOSPITAL_WIDGETS.map((item) => [item.key, item])),
    [],
  );

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Interface Settings
            </p>
            <h1 className="mt-1 text-2xl font-bold">화면 설정</h1>
            <p className="mt-2 text-sm text-slate-600">
              병원에서 사용하는 기능과 대시보드 항목을 선택하고 순서를 변경합니다.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => void reset()}
              disabled={saving}
              className="border border-slate-400 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              기본값 복원
            </button>
          )}
        </div>

        {!canManage && (
          <div className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            현재 계정은 설정을 조회할 수 있지만 변경할 수 없습니다. 원장 또는 관리자 계정에서 변경해 주세요.
          </div>
        )}

        {message && (
          <div className="mt-4 border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {message}
          </div>
        )}

        <div className="mt-5 flex border-b border-slate-300">
          <button
            type="button"
            onClick={() => setTab("features")}
            className={`border-x border-t px-5 py-2 text-sm font-bold ${
              tab === "features"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            병원 기능·메뉴
          </button>
          <button
            type="button"
            onClick={() => setTab("widgets")}
            className={`border-r border-t px-5 py-2 text-sm font-bold ${
              tab === "widgets"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            대시보드 위젯
          </button>
        </div>

        {tab === "features" ? (
          <section className="border border-t-0 border-slate-300 bg-white">
            <div className="border-b border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              숨긴 기능은 삭제되지 않으며 언제든 다시 표시할 수 있습니다. 대시보드는 항상 표시됩니다.
            </div>

            <div>
              {features.map((row, index) => {
                const definition = featureDefinitionMap.get(row.key);
                if (!definition) return null;

                return (
                  <div
                    key={row.key}
                    className="grid gap-3 border-b border-slate-200 px-4 py-4 last:border-b-0 md:grid-cols-[90px_1fr_150px]"
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!canManage || index === 0}
                        onClick={() => moveFeature(index, -1)}
                        className="h-8 w-8 border border-slate-300 bg-white text-xs disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={!canManage || index === features.length - 1}
                        onClick={() => moveFeature(index, 1)}
                        className="h-8 w-8 border border-slate-300 bg-white text-xs disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold">{definition.label}</h2>
                        <span className="border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                          {FEATURE_GROUP_LABELS[definition.group]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {definition.description}
                      </p>
                    </div>

                    <label className="flex items-center justify-end gap-3 text-sm font-semibold">
                      <span>{row.isEnabled ? "표시" : "숨김"}</span>
                      <input
                        type="checkbox"
                        disabled={!canManage || row.key === "dashboard"}
                        checked={row.isEnabled}
                        onChange={(event) => {
                          const next = [...features];
                          next[index] = {
                            ...row,
                            isEnabled: event.target.checked,
                          };
                          setFeatures(next);
                        }}
                        className="h-5 w-5"
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end border-t border-slate-300 bg-slate-50 px-4 py-4">
              <button
                type="button"
                disabled={!canManage || saving}
                onClick={() => void save("features")}
                className="border border-slate-900 bg-slate-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                메뉴 설정 저장
              </button>
            </div>
          </section>
        ) : (
          <section className="border border-t-0 border-slate-300 bg-white">
            <div className="border-b border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              대시보드에서 필요하지 않은 지표와 표를 숨기거나 순서를 변경할 수 있습니다.
            </div>

            <div>
              {widgets.map((row, index) => {
                const definition = widgetDefinitionMap.get(row.key);
                if (!definition) return null;

                return (
                  <div
                    key={row.key}
                    className="grid gap-3 border-b border-slate-200 px-4 py-4 last:border-b-0 md:grid-cols-[90px_1fr_140px_120px]"
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!canManage || index === 0}
                        onClick={() => moveWidget(index, -1)}
                        className="h-8 w-8 border border-slate-300 bg-white text-xs disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={!canManage || index === widgets.length - 1}
                        onClick={() => moveWidget(index, 1)}
                        className="h-8 w-8 border border-slate-300 bg-white text-xs disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>

                    <div>
                      <h2 className="font-bold">{definition.label}</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {definition.description}
                      </p>
                    </div>

                    <label className="text-xs font-semibold text-slate-600">
                      크기
                      <select
                        disabled={!canManage}
                        value={row.size}
                        onChange={(event) => {
                          const next = [...widgets];
                          next[index] = {
                            ...row,
                            size: event.target.value as WidgetRow["size"],
                          };
                          setWidgets(next);
                        }}
                        className="mt-1 w-full border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                      >
                        <option value="small">작게</option>
                        <option value="medium">중간</option>
                        <option value="large">크게</option>
                      </select>
                    </label>

                    <label className="flex items-center justify-end gap-3 text-sm font-semibold">
                      <span>{row.isVisible ? "표시" : "숨김"}</span>
                      <input
                        type="checkbox"
                        disabled={!canManage}
                        checked={row.isVisible}
                        onChange={(event) => {
                          const next = [...widgets];
                          next[index] = {
                            ...row,
                            isVisible: event.target.checked,
                          };
                          setWidgets(next);
                        }}
                        className="h-5 w-5"
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end border-t border-slate-300 bg-slate-50 px-4 py-4">
              <button
                type="button"
                disabled={!canManage || saving}
                onClick={() => void save("widgets")}
                className="border border-slate-900 bg-slate-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                위젯 설정 저장
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
