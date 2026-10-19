import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import { Save, User } from "lucide-react";
import type { WorkbenchSummary } from "@/app/use-workbench-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { readProfileSettings, writeProfileSettings } from "@/lib/workbench-api";
import type { ProfileSettings } from "@/lib/workbench-api";
import { cn } from "@/lib/utils";
import { CapabilityGrid, LegacyHandoff, RouteFrame } from "../readiness/readiness-shared";

const profileTitleCatalog = [
  { id: "developer", label: "开发者", tone: "gold" },
  { id: "round-table-1", label: "圆桌骑士1/150", tone: "blue" }
];
const defaultProfileTitleIds = profileTitleCatalog.map((title) => title.id);
const PROFILE_MAX_WORN_TITLES = 10;
const profileLevelLabels: Record<number, string> = {
  1: "喵喵喵喵喵",
  2: "喵喵喵喵",
  3: "喵喵喵",
  4: "喵喵",
  5: "喵！"
};

function profileTitleLabel(id: string) {
  return profileTitleCatalog.find((title) => title.id === id)?.label || id;
}

function profileTitleTone(id: string) {
  return profileTitleCatalog.find((title) => title.id === id)?.tone || "";
}

function normalizeProfileTitleIds(ids: string[] | undefined, fallbackIds = defaultProfileTitleIds) {
  const result: string[] = [];
  for (const id of ids || []) {
    if (!profileTitleCatalog.some((title) => title.id === id) || result.includes(id)) continue;
    result.push(id);
  }
  if (result.length) return result;
  return fallbackIds.filter((id) => profileTitleCatalog.some((title) => title.id === id));
}

function profileGenderLabel(value?: string) {
  if (value === "male") return "男";
  if (value === "female") return "女";
  return "不显示";
}

function profileAvatarInitial(name?: string) {
  const value = String(name || "M").trim();
  return (value ? value.slice(0, 1) : "M").toUpperCase();
}

function safeProfileLevel(value?: number) {
  return Number.isFinite(value) && value && value > 0 ? Math.min(99, Math.round(value)) : 1;
}

function profileLevelLabel(value?: number) {
  const level = safeProfileLevel(value);
  return profileLevelLabels[Math.min(level, 5)] || profileLevelLabels[1];
}

function profileImageDataUrl(value?: string) {
  return typeof value === "string" && value.startsWith("data:image/") ? value : "";
}

function profileForUi(profile: ProfileSettings): ProfileSettings {
  const ownedTitleIds = normalizeProfileTitleIds(profile.ownedTitleIds);
  const wornFallback = ownedTitleIds[0] ? [ownedTitleIds[0]] : ["developer"];
  const wornTitleIds = normalizeProfileTitleIds(profile.wornTitleIds, wornFallback).filter((id) => ownedTitleIds.includes(id));
  const developerNumericId = Number(profile.developerId);
  const lockedDeveloperId = profile.id === undefined
    ? (Number.isFinite(developerNumericId) && developerNumericId > 0 ? String(Math.round(developerNumericId)) : "1")
    : String(profile.id);
  return {
    ...profile,
    displayName: profile.displayName || "本地开发者",
    developerId: lockedDeveloperId,
    level: safeProfileLevel(profile.level),
    avatarDataUrl: profileImageDataUrl(profile.avatarDataUrl),
    gender: profile.gender || "hidden",
    emailPublic: Boolean(profile.emailPublic),
    signedIn: Boolean(profile.signedIn),
    ownedTitleIds,
    wornTitleIds: wornTitleIds.length ? wornTitleIds : wornFallback
  };
}

export function ProfileRoute({ summary }: { summary: WorkbenchSummary }) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ProfileSettings>(() => profileForUi({
    displayName: summary.profile?.displayName || "本地开发者",
    developerId: summary.profile?.developerId || "1",
    email: summary.profile?.email || "",
    title: summary.profile?.title || "",
    bio: summary.profile?.bio || "",
    level: summary.profile?.level || 1,
    avatarDataUrl: summary.profile?.avatarDataUrl || "",
    gender: summary.profile?.gender || "hidden",
    emailPublic: Boolean(summary.profile?.emailPublic),
    signedIn: Boolean(summary.profile?.signedIn),
    ownedTitleIds: summary.profile?.ownedTitleIds,
    wornTitleIds: summary.profile?.wornTitleIds
  }));
  const [status, setStatus] = useState("准备读取本地 profile。");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const ownedTitleIds = normalizeProfileTitleIds(profile.ownedTitleIds);
  const wornTitleIds = normalizeProfileTitleIds(profile.wornTitleIds, [ownedTitleIds[0] || "developer"]).filter((id) => ownedTitleIds.includes(id));
  const wornTitleLabels = wornTitleIds.map(profileTitleLabel);
  const profileTitleText = wornTitleLabels.join(" / ") || "开发者";
  const avatarDataUrl = profileImageDataUrl(profile.avatarDataUrl);
  const developerNumericId = Number(profile.developerId);
  const lockedDeveloperId = profile.id === undefined
    ? (Number.isFinite(developerNumericId) && developerNumericId > 0 ? String(Math.round(developerNumericId)) : "1")
    : String(profile.id);
  const profileId = lockedDeveloperId;

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setLoading(true);
      try {
        const nextProfile = await readProfileSettings();
        if (cancelled) return;
        setProfile(profileForUi(nextProfile));
        setStatus("已读取本地 profile。");
      } catch (error) {
        if (cancelled) return;
        setStatus(`profile 读取失败：${error instanceof Error ? error.message : String(error)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistProfile(nextProfile: ProfileSettings, message: string) {
    setSaving(true);
    try {
      const normalized = profileForUi(nextProfile);
      const saved = await writeProfileSettings(normalized);
      setProfile(profileForUi(saved));
      summary.refresh();
      setStatus(message);
    } catch (error) {
      setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = profile.displayName.trim();
    if (!displayName) {
      setStatus("名称不能为空。");
      return;
    }
    await persistProfile({
      ...profile,
      displayName,
      developerId: lockedDeveloperId,
      email: profile.email?.trim() || "",
      title: profileTitleText,
      bio: profile.bio?.trim() || "",
      level: safeProfileLevel(profile.level),
      gender: profile.gender || "hidden",
      emailPublic: Boolean(profile.emailPublic),
      signedIn: Boolean(profile.signedIn),
      ownedTitleIds,
      wornTitleIds
    }, "个人资料已保存。");
  }

  async function toggleProfileTitle(titleId: string) {
    if (!ownedTitleIds.includes(titleId)) return;
    const active = wornTitleIds.includes(titleId);
    if (active && wornTitleIds.length <= 1) {
      setStatus("至少保留一个佩戴称号。");
      return;
    }
    if (!active && wornTitleIds.length >= PROFILE_MAX_WORN_TITLES) {
      setStatus("最多佩戴 10 个称号。");
      return;
    }
    const nextWornTitleIds = active ? wornTitleIds.filter((id) => id !== titleId) : [...wornTitleIds, titleId];
    const nextTitleText = nextWornTitleIds.map(profileTitleLabel).join(" / ") || "开发者";
    await persistProfile({ ...profile, title: nextTitleText, ownedTitleIds, wornTitleIds: nextWornTitleIds }, "称号已更新。");
  }

  async function handleAvatarFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("请选择图片文件作为头像。");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStatus("头像图片过大，建议选择 2MB 以内的图片。");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const avatarDataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!profileImageDataUrl(avatarDataUrl)) {
        setStatus("头像读取失败，请换一张图片试试。");
        return;
      }
      void persistProfile({ ...profile, avatarDataUrl }, "头像已更新。");
    });
    reader.addEventListener("error", () => setStatus("头像读取失败，请换一张图片试试。"));
    reader.readAsDataURL(file);
  }

  return (
    <RouteFrame
      id="profile"
      eyebrow="Profile"
      title="资料编辑"
      copy="这个页面只负责编辑 Lobby 里的本地公开资料卡；头像、等级、性别、邮箱公开和称号会回写本机 profile storage。"
      badge="local profile editor"
    >
      <div className="grid h-full min-h-0 gap-4 min-[1120px]:grid-cols-[minmax(360px,0.72fr)_minmax(0,1fr)]">
        <Panel className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <PanelHeader>
            <div>
              <div className="text-sm font-semibold">公开资料卡</div>
              <div className="text-xs text-muted-foreground">Lobby 中展示的公开身份</div>
            </div>
            <Badge variant={profile.signedIn ? "success" : "default"}>{profile.signedIn ? "本机已登录" : "本机资料"}</Badge>
          </PanelHeader>
          <PanelBody className="min-h-0 overflow-y-auto">
            <div className="grid gap-4" data-profile-readiness-card>
              <div className="grid justify-items-center gap-3 text-center">
                <button
                  type="button"
                  className="meowdesk-profile-avatar-edit relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border border-primary/35 bg-primary/12 text-2xl font-semibold text-primary shadow-sm"
                  data-r1-profile-avatar
                  onClick={() => avatarInputRef.current?.click()}
                  aria-label="更换头像"
                >
                  {avatarDataUrl ? <img className="h-full w-full object-cover" src={avatarDataUrl} alt="" /> : <span>{profileAvatarInitial(profile.displayName)}</span>}
                  <span className="meowdesk-profile-avatar-edit-label">更换头像</span>
                </button>
                <input
                  ref={avatarInputRef}
                  className="hidden"
                  data-r1-profile-avatar-input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    void handleAvatarFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <div className="min-w-0">
                  <div className="truncate text-xl font-semibold" data-r1-profile-card-name>{profile.displayName || "本地开发者"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">ID {profileId}</div>
                  <div className="mt-3 flex flex-wrap gap-2" data-r1-profile-title-list>
                    {wornTitleIds.map((id) => (
                      <span
                        key={id}
                        className={cn(
                          "inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium",
                          profileTitleTone(id) === "gold" && "border-warning/35 bg-warning/12 text-warning",
                          profileTitleTone(id) === "blue" && "border-primary/35 bg-primary/12 text-primary"
                        )}
                        data-r1-profile-worn-title={id}
                      >
                        {profileTitleLabel(id)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-2 rounded-md border border-border bg-background/55 p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">等级</span>
                  <strong data-r1-profile-level-label>LV{safeProfileLevel(profile.level)} · {profileLevelLabel(profile.level)}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">性别</span>
                  <strong>{profileGenderLabel(profile.gender)}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">邮箱</span>
                  <strong className="truncate">{profile.email && profile.emailPublic ? profile.email : "邮箱不公开"}</strong>
                </div>
              </div>
              <p className="leading-5 text-muted-foreground">{profile.bio || "这个本地资料还没有写简介。"}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" size="sm" onClick={() => {
                  window.history.replaceState(null, "", "#lobby");
                  window.dispatchEvent(new HashChangeEvent("hashchange"));
                }}>
                  <User size={14} aria-hidden="true" />
                  回到 Lobby 资料卡
                </Button>
              </div>
            </div>
          </PanelBody>
        </Panel>
        <div className="grid min-h-0 content-start gap-3 overflow-y-auto pr-1">
          <Panel>
            <PanelHeader>
              <div>
                <div className="text-sm font-semibold">编辑公开资料</div>
                <div className="text-xs text-muted-foreground">写入 Meowdesk Home profile storage</div>
              </div>
              <Badge variant={loading ? "warning" : "success"}>{loading ? "loading" : "editable"}</Badge>
            </PanelHeader>
            <PanelBody>
              <form className="grid gap-3" data-r1-profile-form onSubmit={saveProfile}>
                <div className="grid gap-3 min-[760px]:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-muted-foreground">显示名称</span>
                    <Input
                      data-r1-profile-display-name
                      value={profile.displayName || ""}
                      maxLength={24}
                      onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-muted-foreground">开发者 ID</span>
                    <Input
                      data-r1-profile-developer-id
                      value={lockedDeveloperId}
                      maxLength={32}
                      readOnly
                      disabled
                      aria-readonly="true"
                      title="开发者 ID 由注册顺序生成，不能手动编辑。"
                    />
                  </label>
                </div>
                <div className="grid gap-3 min-[760px]:grid-cols-[1fr_110px]">
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-muted-foreground">邮箱</span>
                    <Input
                      data-r1-profile-email
                      type="email"
                      value={profile.email || ""}
                      maxLength={80}
                      onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-muted-foreground">等级</span>
                    <Input
                      data-r1-profile-level
                      type="number"
                      min={1}
                      max={99}
                      value={safeProfileLevel(profile.level)}
                      readOnly
                      disabled
                      aria-readonly="true"
                      title="等级来自账号成长与成就，当前只读展示。"
                    />
                  </label>
                </div>
                <div className="grid items-end gap-3 min-[760px]:grid-cols-[160px_1fr]">
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-muted-foreground">性别</span>
                    <select
                      data-r1-profile-gender
                      className="h-9 rounded-md border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                      value={profile.gender || "hidden"}
                      onChange={(event) => setProfile((current) => ({ ...current, gender: event.target.value }))}
                    >
                      <option value="hidden">不显示</option>
                      <option value="male">男</option>
                      <option value="female">女</option>
                    </select>
                  </label>
                  <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background/55 px-3 text-sm">
                    <input
                      data-r1-profile-email-public
                      type="checkbox"
                      checked={Boolean(profile.emailPublic)}
                      onChange={(event) => setProfile((current) => ({ ...current, emailPublic: event.target.checked }))}
                    />
                    <span>公开邮箱</span>
                  </label>
                </div>
                <div className="grid gap-2">
                  <span className="text-xs font-medium text-muted-foreground">当前佩戴称号</span>
                  <div
                    className="min-h-9 rounded-md border border-border bg-background/55 px-3 py-2 text-sm text-foreground"
                    data-r1-profile-title-current
                  >
                    {profileTitleText}
                  </div>
                  <span className="text-xs leading-5 text-muted-foreground">称号由平台颁发或成就解锁，这里只能选择已解锁称号佩戴。</span>
                </div>
                <label className="grid gap-2">
                  <span className="text-xs font-medium text-muted-foreground">简介</span>
                  <textarea
                    data-r1-profile-bio
                    className="min-h-20 resize-none rounded-md border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                    value={profile.bio || ""}
                    maxLength={160}
                    onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                  />
                </label>
                <div className="grid gap-2">
                  <div className="text-xs font-medium text-muted-foreground">已解锁称号</div>
                  <div className="flex flex-wrap gap-2" data-r1-profile-title-picker>
                    {ownedTitleIds.map((id) => {
                      const active = wornTitleIds.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          className={cn(
                            "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors",
                            profileTitleTone(id) === "gold" && "border-warning/35 bg-warning/10 text-warning",
                            profileTitleTone(id) === "blue" && "border-primary/35 bg-primary/10 text-primary",
                            active && "bg-surface-raised ring-1 ring-primary/35",
                            saving && "opacity-60"
                          )}
                          data-r1-profile-title-chip={id}
                          data-r1-profile-title-active={active ? "true" : undefined}
                          disabled={saving}
                          onClick={() => void toggleProfileTitle(id)}
                        >
                          {profileTitleLabel(id)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground" data-r1-profile-status>{status}</div>
                  <Button data-r1-profile-save type="submit" disabled={saving || loading || !profile.displayName.trim()}>
                    <Save size={15} aria-hidden="true" />
                    {saving ? "保存中" : "保存资料"}
                  </Button>
                </div>
              </form>
            </PanelBody>
          </Panel>
          <CapabilityGrid
            items={[
              { label: "资料展示", state: "next", detail: "next 读取本地 profile，并展示头像、ID、等级、性别、邮箱和简介。" },
              { label: "资料编辑", state: "next", detail: "通过 typed storage adapter 写回 profile；开发者 ID 和等级只读，不新增 IPC。" },
              { label: "称号系统", state: "next", detail: "称号由平台颁发或成就解锁，用户只能佩戴已解锁 chip。" },
              { label: "远端账号", state: "protected", detail: "正式登录、设备授权和远端同步后续单独接入。" }
            ]}
          />
          <LegacyHandoff id="profile" title="Profile auth handoff" detail="账号、好友主页和远端同步后续单独接入；本轮只恢复本地公开资料卡。" />
        </div>
      </div>
    </RouteFrame>
  );
}
